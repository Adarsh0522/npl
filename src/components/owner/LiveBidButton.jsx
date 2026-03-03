import React from 'react';
import { useBidTransaction } from '../../hooks/useBidTransaction';
import { useAuction } from '../../context/AuctionContext';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpCircle, AlertCircle } from 'lucide-react';

export const LiveBidButton = ({ remainingWallet }) => {
    const { auctionState } = useAuction();
    const { userTeamId } = useAuth();
    const { placeBid, loading, error } = useBidTransaction();

    const isLive = auctionState?.status === 'LIVE';
    const isLeading = auctionState?.leadingTeamId === userTeamId;
    const increment = auctionState?.increment || 500;
    const nextBid = auctionState?.currentBid === 0
        ? (auctionState?.basePrice || 1000)
        : (auctionState?.currentBid || 0) + increment;

    const hasInsufficientBalance = isLive && (remainingWallet < nextBid);
    const hasNoPlayer = !auctionState?.currentPlayerId;

    // Determine disable reason
    const getDisableReason = () => {
        if (!isLive) return 'Auction Not Active';
        if (hasNoPlayer) return 'No Player Active';
        if (isLeading) return 'You Hold the Highest Bid';
        if (hasInsufficientBalance) return 'Insufficient Balance';
        return null;
    };

    const disableReason = getDisableReason();
    const isDisabled = !!disableReason || loading;

    return (
        <div className="flex flex-col items-center w-full relative z-10 flex-1 justify-end">

            {error && (
                <div className="mb-4 w-full p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start justify-center text-red-400">
                    <AlertCircle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-center">{error}</span>
                </div>
            )}

            {isLeading && isLive && (
                <div className="mb-4 text-green-400 font-bold uppercase tracking-widest text-sm flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></span>
                    You hold the highest bid
                </div>
            )}

            <button
                onClick={placeBid}
                disabled={isDisabled}
                className={`w-full max-w-sm py-6 rounded-2xl font-black text-2xl tracking-wider shadow-2xl transition-all duration-300 flex flex-col items-center justify-center ${!isDisabled
                    ? 'bg-brand-neon tracking-tighter text-black hover:bg-white hover:shadow-[0_0_30px_rgba(57,255,20,0.6)] cursor-pointer scale-100 hover:scale-105 active:scale-95'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-80'
                    }`}
            >
                <span className="flex items-center">
                    {hasInsufficientBalance ? <AlertCircle size={28} className="mr-3 text-red-500" /> : <ArrowUpCircle size={28} className="mr-3" />}
                    {loading ? 'BIDDING...' : disableReason || 'PLACE BID'}
                </span>
                <span className={`text-sm font-medium opacity-80 mt-1 uppercase tracking-widest ${hasInsufficientBalance ? 'text-red-400' : ''}`}>
                    {isLive && !hasNoPlayer ? `For ₹${nextBid.toLocaleString()}` : disableReason || 'Waiting...'}
                </span>
            </button>

        </div>
    );
};
