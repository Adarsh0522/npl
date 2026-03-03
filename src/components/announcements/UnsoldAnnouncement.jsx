import React from 'react';
import { XCircle } from 'lucide-react';

/**
 * Clean "UNSOLD" announcement screen.
 * Displayed for ~2s after a player goes unsold, before advancing.
 */
export default function UnsoldAnnouncement({ playerName, basePrice }) {
    return (
        <div className="w-full flex flex-col items-center justify-center py-10 px-4 animate-[fadeIn_0.3s_ease-out]">
            {/* UNSOLD badge */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-red-500/15 rounded-full blur-3xl scale-150" />
                <div className="relative border-4 border-red-500 text-red-400 px-8 py-3 rounded-xl font-black text-5xl md:text-6xl tracking-[0.2em] uppercase shadow-[0_0_40px_rgba(239,68,68,0.3)] bg-red-500/10">
                    UNSOLD
                </div>
            </div>

            {/* Player name */}
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight text-center text-wrap-fix mb-3">
                {playerName}
            </h2>

            {/* Base price */}
            <div className="flex items-center gap-3 mb-4">
                <span className="text-gray-400 text-lg font-bold uppercase tracking-wider">Base Price:</span>
                <span className="text-gray-300 text-3xl font-black tracking-tighter">
                    ₹{(Number(basePrice) || 0).toLocaleString()}
                </span>
            </div>

            {/* Icon */}
            <div className="mt-2 p-4 bg-red-500/5 border border-red-500/20 rounded-full">
                <XCircle size={32} className="text-red-400" />
            </div>
        </div>
    );
}
