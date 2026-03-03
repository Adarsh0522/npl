import { useEffect, useRef, useCallback } from 'react';
import { doc, collection, query, where, orderBy, limit, getDocs, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuction } from '../context/AuctionContext';
import { useAuctionTimer } from './useAuctionTimer';

/**
 * Resolve current player when timer expires.
 * Safely callable from ANY page — Firestore transaction guard
 * ensures only one execution succeeds per player.
 * 
 * NEW: Delay-then-advance architecture.
 * On resolve, writes lastResolvedPlayerId/Status/At + nextPlayerScheduledAt.
 * A separate interval watches for nextPlayerScheduledAt and triggers advance.
 * 
 * 🔒 SAFETY 1: nextPlayerScheduledAt cleared immediately after advance.
 * 🔒 SAFETY 2: Guard if (!nextPlayerScheduledAt) return; before comparisons.
 * 🔒 SAFETY 3: Transaction guard verifies currentPlayerId === lastResolvedPlayerId.
 */
export const useAuctionResolver = () => {
    const { auctionState } = useAuction();
    const { isExpired } = useAuctionTimer();
    const resolvingRef = useRef(false);
    const lastResolvedRef = useRef(null);
    const advancingRef = useRef(false);

    const resolveCurrentPlayer = useCallback(async () => {
        // Local guard: prevent concurrent calls from same client
        if (resolvingRef.current) return;
        resolvingRef.current = true;

        try {
            const auctionRef = doc(db, 'settings', 'auction');

            await runTransaction(db, async (transaction) => {
                // 1. Read auction state inside transaction
                const auctionSnap = await transaction.get(auctionRef);
                if (!auctionSnap.exists()) return;

                const auction = auctionSnap.data();

                // GUARD: Already resolved for this player
                if (auction.resolvedForPlayer === auction.currentPlayerId) {
                    return;
                }

                // GUARD: No current player
                if (!auction.currentPlayerId) return;

                // GUARD: Auction not live
                if (auction.status !== 'LIVE') return;

                // GUARD: Timer hasn't actually expired (check server-stored time)
                const startMs = typeof auction.timerStartedAt?.toMillis === 'function'
                    ? auction.timerStartedAt.toMillis()
                    : typeof auction.timerStartedAt?.seconds === 'number'
                        ? auction.timerStartedAt.seconds * 1000
                        : auction.timerStartedAt;

                const endsAt = startMs + (auction.timerDuration || 30000);
                if (Date.now() < endsAt) return;

                // 2. Read current player inside transaction
                const playerRef = doc(db, 'players', auction.currentPlayerId);
                const playerSnap = await transaction.get(playerRef);
                if (!playerSnap.exists()) return;

                const player = playerSnap.data();

                // GUARD: Player already resolved
                if (player.status !== 'LIVE') return;

                // Determine SOLD or UNSOLD
                const isSold = !!(auction.leadingTeamId && auction.currentBid > 0);
                const delayMs = isSold ? 3000 : 2000;

                // 3. Sell or Unsold
                if (isSold) {
                    // SELL — read team for totalSpent/squadCount update
                    const teamRef = doc(db, 'teams', auction.leadingTeamId);
                    const teamSnap = await transaction.get(teamRef);

                    if (teamSnap.exists()) {
                        const teamData = teamSnap.data();
                        transaction.update(teamRef, {
                            totalSpent: (teamData.totalSpent || 0) + auction.currentBid,
                            squadCount: (teamData.squadCount || 0) + 1
                        });
                    }

                    transaction.update(playerRef, {
                        status: 'SOLD',
                        teamId: auction.leadingTeamId,
                        soldPrice: auction.currentBid
                    });
                } else {
                    // UNSOLD
                    transaction.update(playerRef, {
                        status: 'UNSOLD',
                        teamId: null,
                        soldPrice: 0
                    });
                }

                // 4. Mark resolved + schedule next player advance (delay-then-advance)
                // DO NOT call advanceToNextPlayer() immediately
                transaction.update(auctionRef, {
                    resolvedForPlayer: auction.currentPlayerId,
                    lastPlayerId: auction.currentPlayerId,
                    lastResolvedPlayerId: auction.currentPlayerId,
                    lastResolvedStatus: isSold ? 'SOLD' : 'UNSOLD',
                    lastResolvedAt: serverTimestamp(),
                    nextPlayerScheduledAt: Date.now() + delayMs,
                    status: 'ANNOUNCING'
                });
            });

        } catch (err) {
            console.error('Resolve failed:', err);
        } finally {
            resolvingRef.current = false;
        }
    }, []);

    /**
     * Advance to the next UPCOMING player.
     * Uses a transaction guard to ensure only one client advances.
     * 🔒 SAFETY 1: Clears nextPlayerScheduledAt immediately after success.
     * 🔒 SAFETY 3: Verifies currentPlayerId === lastResolvedPlayerId.
     */
    const advanceToNextPlayer = useCallback(async () => {
        if (advancingRef.current) return;
        advancingRef.current = true;

        try {
            const auctionRef = doc(db, 'settings', 'auction');

            // Fetch eligible players globally (no queue order)
            const eligibleSnap = await getDocs(
                query(
                    collection(db, 'players'),
                    where('status', 'in', ['READY', 'UNSOLD'])
                )
            );

            if (eligibleSnap.empty) {
                // No more players — end auction
                await runTransaction(db, async (transaction) => {
                    const freshAuction = await transaction.get(auctionRef);
                    if (!freshAuction.exists()) return;
                    const freshData = freshAuction.data();

                    // 🔒 GUARD: Only end from ANNOUNCING state
                    if (freshData.status !== 'ANNOUNCING') return;

                    // 🔒 SAFETY 3: Only end if we're still on the resolved player
                    if (freshData.currentPlayerId !== freshData.lastResolvedPlayerId) return;

                    transaction.update(auctionRef, {
                        status: 'ENDED',
                        currentPlayerId: null,
                        timerStartedAt: null,
                        currentBid: 0,
                        leadingTeamId: null,
                        // 🔒 SAFETY 1: Clear scheduled time
                        nextPlayerScheduledAt: null,
                        lastResolvedPlayerId: null,
                        lastResolvedStatus: null,
                        lastResolvedAt: null
                    });
                });
            } else {
                // Randomly select one eligible player
                const players = eligibleSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const randomIndex = Math.floor(Math.random() * players.length);
                const selectedPlayer = players[randomIndex];

                await runTransaction(db, async (transaction) => {
                    const freshAuction = await transaction.get(auctionRef);
                    if (!freshAuction.exists()) return;
                    const freshData = freshAuction.data();

                    // 🔒 SAFETY GUARD
                    if (
                        freshData.status !== "ANNOUNCING" &&
                        freshData.status !== "LIVE" &&
                        freshData.status !== "PAUSED"
                    ) {
                        return;
                    }

                    // 🔒 SAFETY 3: Verify currentPlayerId === lastResolvedPlayerId
                    // If someone else already advanced, skip
                    if (freshData.status === 'ANNOUNCING' && freshData.currentPlayerId !== freshData.lastResolvedPlayerId) return;

                    const playerRef = doc(db, "players", selectedPlayer.id);
                    const freshPlayerSnap = await transaction.get(playerRef);
                    if (!freshPlayerSnap.exists()) return;
                    const freshPlayer = freshPlayerSnap.data();

                    // Prevent SOLD player re-entry
                    if (freshPlayer.status === "SOLD") {
                        return;
                    }

                    transaction.update(playerRef, { status: 'LIVE' });
                    transaction.update(auctionRef, {
                        currentPlayerId: selectedPlayer.id,
                        currentBid: freshPlayer.basePrice || 0,
                        leadingTeamId: null,
                        timerStartedAt: serverTimestamp(),
                        status: "LIVE",
                        lastResolvedPlayerId: null,
                        lastResolvedStatus: null,
                        nextPlayerScheduledAt: null
                    });
                });
            }
        } catch (err) {
            console.error('Advance to next player failed:', err);
        } finally {
            advancingRef.current = false;
        }
    }, []);

    // Auto-trigger resolution when timer expires
    useEffect(() => {
        if (isExpired && auctionState?.status === 'LIVE' && auctionState?.currentPlayerId) {
            // Don't re-resolve same player from this client
            if (lastResolvedRef.current === auctionState.currentPlayerId) return;

            lastResolvedRef.current = auctionState.currentPlayerId;
            resolveCurrentPlayer();
        }
        // Also attempt resolve if status is still LIVE but player is already resolved
        // (handles edge case where status update failed)

        // Reset when player changes
        if (auctionState?.currentPlayerId !== lastResolvedRef.current) {
            lastResolvedRef.current = null;
        }
    }, [isExpired, auctionState?.status, auctionState?.currentPlayerId, resolveCurrentPlayer]);

    /**
     * Watch nextPlayerScheduledAt and auto-advance after delay.
     * Runs on an interval to check if it's time to advance.
     * 🔒 SAFETY 2: Guard if (!nextPlayerScheduledAt) return;
     */
    useEffect(() => {
        // 🔒 GUARD: Only auto-advance from ANNOUNCING state
        if (auctionState?.status !== 'ANNOUNCING') return;

        // 🔒 SAFETY 2: Don't run if no scheduled time
        if (!auctionState?.nextPlayerScheduledAt) return;

        // Don't auto-advance if autoAdvance is explicitly OFF
        if (auctionState?.autoAdvance === false) return;

        // Only advance if we're in the announcement state
        // (currentPlayerId === lastResolvedPlayerId)
        if (auctionState?.currentPlayerId !== auctionState?.lastResolvedPlayerId) return;

        const checkAndAdvance = () => {
            // 🔒 SAFETY 2: Re-check guard
            if (!auctionState?.nextPlayerScheduledAt) return;

            if (Date.now() >= auctionState.nextPlayerScheduledAt) {
                // 🔒 SAFETY 3: Final guard check before advancing
                if (auctionState.currentPlayerId === auctionState.lastResolvedPlayerId) {
                    advanceToNextPlayer();
                }
            }
        };

        // Check immediately
        checkAndAdvance();

        // Also poll every 500ms in case the initial check was too early
        const interval = setInterval(checkAndAdvance, 500);
        return () => clearInterval(interval);
    }, [
        auctionState?.status,
        auctionState?.nextPlayerScheduledAt,
        auctionState?.currentPlayerId,
        auctionState?.lastResolvedPlayerId,
        auctionState?.autoAdvance,
        advanceToNextPlayer
    ]);

    return { resolveCurrentPlayer, advanceToNextPlayer };
};
