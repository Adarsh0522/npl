import { useEffect, useRef, useCallback } from 'react';
import { doc, collection, query, where, orderBy, limit, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuction } from '../context/AuctionContext';
import { useAuctionTimer } from './useAuctionTimer';

/**
 * Resolve current player when timer expires.
 * Safely callable from ANY page — Firestore transaction guard
 * ensures only one execution succeeds per player.
 * 
 * Guard mechanism: `resolvedForPlayer` field in auction doc.
 * If resolvedForPlayer === currentPlayerId, the player was already resolved.
 */
export const useAuctionResolver = () => {
    const { auctionState } = useAuction();
    const { isExpired } = useAuctionTimer();
    const resolvingRef = useRef(false);
    const lastResolvedRef = useRef(null);

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

                // 3. Sell or Unsold
                if (auction.leadingTeamId && auction.currentBid > 0) {
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

                // 4. Mark resolved for this player
                // 5. Advance to next UPCOMING player (outside transaction for the query)
                // We need to find next player — but we can't query inside transaction.
                // So we mark resolved and set a flag to advance after transaction.
                transaction.update(auctionRef, {
                    resolvedForPlayer: auction.currentPlayerId,
                    lastPlayerId: auction.currentPlayerId,
                    // Temporarily pause while we advance
                    status: 'LIVE'
                });
            });

            // After transaction succeeds, advance to next player
            // This is a separate write — safe because resolvedForPlayer prevents re-resolution
            await advanceToNextPlayer();

        } catch (err) {
            console.error('Resolve failed:', err);
        } finally {
            resolvingRef.current = false;
        }
    }, []);

    const advanceToNextPlayer = async () => {
        try {
            const auctionRef = doc(db, 'settings', 'auction');

            // Check if we actually need to advance (transaction may have been skipped)
            const { getDoc } = await import('firebase/firestore');
            const auctionSnap = await getDoc(auctionRef);
            const auction = auctionSnap.data();

            // Only advance if the current player matches what we just resolved
            if (auction.resolvedForPlayer !== auction.lastPlayerId) return;
            // Don't advance if someone already advanced (currentPlayerId changed)
            if (auction.currentPlayerId !== auction.lastPlayerId) return;

            const qUp = query(
                collection(db, 'players'),
                where('status', '==', 'UPCOMING'),
                orderBy('createdAt', 'asc'),
                limit(1)
            );
            const upSnap = await getDocs(qUp);

            if (!upSnap.empty) {
                const nextDoc = upSnap.docs[0];

                await runTransaction(db, async (transaction) => {
                    // Re-check guard inside transaction
                    const freshAuction = await transaction.get(auctionRef);
                    const freshData = freshAuction.data();

                    // If someone else already advanced, skip
                    if (freshData.currentPlayerId !== freshData.lastPlayerId) return;

                    transaction.update(doc(db, 'players', nextDoc.id), { status: 'LIVE' });
                    transaction.update(auctionRef, {
                        currentPlayerId: nextDoc.id,
                        currentBid: nextDoc.data().basePrice || 0,
                        leadingTeamId: null,
                        timerStartedAt: serverTimestamp(),
                        timerDuration: 30000,
                        status: 'LIVE'
                    });
                });
            } else {
                // No more players — end auction
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(auctionRef, {
                    status: 'ENDED',
                    currentPlayerId: null,
                    leadingTeamId: null,
                    currentBid: 0
                });
            }
        } catch (err) {
            console.error('Advance to next player failed:', err);
        }
    };

    // Auto-trigger resolution when timer expires
    useEffect(() => {
        if (isExpired && auctionState?.status === 'LIVE' && auctionState?.currentPlayerId) {
            // Don't re-resolve same player from this client
            if (lastResolvedRef.current === auctionState.currentPlayerId) return;

            lastResolvedRef.current = auctionState.currentPlayerId;
            resolveCurrentPlayer();
        }

        // Reset when player changes
        if (auctionState?.currentPlayerId !== lastResolvedRef.current) {
            lastResolvedRef.current = null;
        }
    }, [isExpired, auctionState?.status, auctionState?.currentPlayerId, resolveCurrentPlayer]);

    return { resolveCurrentPlayer };
};
