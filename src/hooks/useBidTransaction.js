import { useState } from 'react';
import { doc, runTransaction, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuction } from '../context/AuctionContext';
import { useAuth } from '../context/AuthContext';

export const useBidTransaction = () => {
    const { auctionState } = useAuction();
    const { userTeamId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const placeBid = async () => {
        if (!auctionState || auctionState.status !== 'LIVE') {
            setError('Auction is not live');
            return false;
        }

        if (!userTeamId) {
            setError('You are not assigned to a team');
            return false;
        }

        if (!auctionState.currentPlayerId) {
            setError('No player is currently up for auction');
            return false;
        }

        if (auctionState.leadingTeamId === userTeamId) {
            setError('You already hold the highest bid');
            return false;
        }

        setLoading(true);
        setError('');

        try {
            const auctionRef = doc(db, 'settings', 'auction');
            const teamRef = doc(db, 'teams', userTeamId);

            await runTransaction(db, async (transaction) => {
                // 1. Read both docs inside transaction for atomic consistency
                const auctionSnap = await transaction.get(auctionRef);
                const teamSnap = await transaction.get(teamRef);

                if (!auctionSnap.exists()) throw new Error('Auction state not found');
                if (!teamSnap.exists()) throw new Error('Team does not exist');

                const freshAuction = auctionSnap.data();
                const teamData = teamSnap.data();

                // 2. Re-validate auction is still LIVE inside transaction
                if (freshAuction.status !== 'LIVE') {
                    throw new Error('Auction is no longer live');
                }

                // 3. Re-validate not already leading
                if (freshAuction.leadingTeamId === userTeamId) {
                    throw new Error('You already hold the highest bid');
                }

                // 4. Calculate next bid from fresh auction data
                const increment = freshAuction.increment || 500;
                const newBid = freshAuction.currentBid === 0
                    ? (freshAuction.basePrice || 1000)
                    : freshAuction.currentBid + increment;

                // 5. Validate wallet using team.totalSpent inside transaction
                const totalSpent = teamData.totalSpent || 0;
                const totalBudget = teamData.totalBudget || 0;

                if (totalSpent + newBid > totalBudget) {
                    throw new Error(`Insufficient balance. Wallet: ₹${(totalBudget - totalSpent).toLocaleString()}, Bid: ₹${newBid.toLocaleString()}`);
                }

                // 6. Validate squad capacity
                const squadCount = teamData.squadCount || 0;
                const maxPlayers = teamData.maxPlayers || 15;
                if (squadCount >= maxPlayers) {
                    throw new Error('Squad is full');
                }

                // 7. Append bid to player's bidHistory
                const playerRef = doc(db, 'players', freshAuction.currentPlayerId);
                transaction.update(playerRef, {
                    bidHistory: arrayUnion({
                        teamId: userTeamId,
                        teamName: teamData.name || 'Unknown',
                        amount: newBid,
                        timestamp: Date.now()
                    })
                });

                // 8. Update auction state atomically — reset timer with server time
                transaction.update(auctionRef, {
                    currentBid: newBid,
                    leadingTeamId: userTeamId,
                    timerStartedAt: serverTimestamp(),
                    timerDuration: 30000
                });
            });

            return true;
        } catch (err) {
            console.error('Bid transaction failed:', err);
            setError(err.message || 'Transaction failed');
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { placeBid, loading, error };
};
