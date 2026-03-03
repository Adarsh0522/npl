import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

/**
 * Bid history for a sold player.
 * Desktop: scrollable inside fixed-height container.
 * Mobile: accordion (collapsible).
 */
export const BidHistory = ({ bidHistory = [] }) => {
    const [expanded, setExpanded] = useState(false);

    if (!bidHistory || bidHistory.length === 0) {
        return (
            <div className="mt-2 px-3 py-2 bg-gray-900/50 rounded border border-gray-800 text-xs text-gray-600 text-center font-bold uppercase tracking-widest">
                No bid history
            </div>
        );
    }

    const sorted = [...bidHistory].sort((a, b) => (b.amount || 0) - (a.amount || 0));

    return (
        <div className="mt-2">
            {/* Mobile accordion toggle */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="md:hidden w-full flex items-center justify-between px-3 py-2 bg-gray-900/80 rounded border border-gray-800 text-xs font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-800 transition"
            >
                <span>Bid History ({sorted.length})</span>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Desktop: always visible, scrollable. Mobile: collapsible */}
            <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
                <div className="max-h-[160px] overflow-y-auto custom-scrollbar mt-1 bg-gray-900/60 rounded border border-gray-800">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-900 z-10">
                            <tr className="border-b border-gray-800">
                                <th className="text-left py-1.5 px-3 font-bold text-gray-500 uppercase tracking-widest">Team</th>
                                <th className="text-right py-1.5 px-3 font-bold text-gray-500 uppercase tracking-widest">Bid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((bid, idx) => (
                                <tr key={idx} className={`border-b border-gray-800/50 ${idx === 0 ? 'bg-brand-neon/5' : ''}`}>
                                    <td className="py-1.5 px-3 text-gray-300 font-medium truncate max-w-[120px]">
                                        {bid.teamName || 'Unknown'}
                                        {idx === 0 && <span className="ml-1.5 text-brand-neon text-[9px] font-black">WINNER</span>}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-black text-white">
                                        ₹{(bid.amount || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
