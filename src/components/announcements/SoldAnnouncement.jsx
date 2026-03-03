import React from 'react';
import { Trophy } from 'lucide-react';

/**
 * High-impact "SOLD" announcement screen.
 * Displayed for ~3s after a player is sold, before advancing.
 */
export default function SoldAnnouncement({ playerName, soldPrice, teamName, bidHistory = [] }) {
    const recentBids = [...bidHistory]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 5);

    return (
        <div className="w-full flex flex-col items-center justify-center py-8 px-4 animate-[fadeIn_0.3s_ease-out]">
            {/* SOLD badge */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-3xl scale-150 animate-pulse" />
                <div className="relative border-4 border-green-500 text-green-400 px-8 py-3 rounded-xl font-black text-5xl md:text-6xl tracking-[0.2em] uppercase shadow-[0_0_40px_rgba(34,197,94,0.4)] bg-green-500/10">
                    SOLD
                </div>
            </div>

            {/* Player name */}
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight text-center text-wrap-fix mb-3">
                {playerName}
            </h2>

            {/* Price */}
            <div className="flex items-center gap-3 mb-4">
                <span className="text-brand-neon text-5xl md:text-6xl font-black tracking-tighter">
                    ₹{(Number(soldPrice) || 0).toLocaleString()}
                </span>
            </div>

            {/* Winning team */}
            <div className="flex items-center gap-2 bg-brand-neon/10 border border-brand-neon/30 px-6 py-3 rounded-xl mb-6">
                <Trophy size={20} className="text-brand-neon flex-shrink-0" />
                <span className="text-brand-neon font-black uppercase tracking-wider text-lg text-wrap-fix">
                    {teamName || 'Unknown Team'}
                </span>
            </div>

            {/* Compact bid history */}
            {recentBids.length > 0 && (
                <div className="w-full max-w-sm bg-gray-900/60 rounded-lg border border-gray-800 overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 py-2 border-b border-gray-800">
                        Bid History
                    </p>
                    <div className="max-h-[120px] overflow-y-auto custom-scrollbar">
                        {recentBids.map((bid, idx) => (
                            <div key={idx} className={`flex justify-between items-center px-3 py-1.5 text-xs border-b border-gray-800/50 ${idx === 0 ? 'bg-brand-neon/5' : ''}`}>
                                <span className="text-gray-300 font-medium text-wrap-fix">
                                    {bid.teamName || 'Unknown'}
                                    {idx === 0 && <span className="ml-1.5 text-brand-neon text-[9px] font-black">WINNER</span>}
                                </span>
                                <span className="font-black text-white flex-shrink-0 ml-2">₹{(bid.amount || 0).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
