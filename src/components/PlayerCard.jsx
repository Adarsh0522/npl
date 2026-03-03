import React from 'react';
import { User } from 'lucide-react';

const formatDriveImage = (url) => {
    if (!url) return null;
    if (!url.includes("drive.google.com")) return url;

    let fileId = null;
    if (url.includes("open?id=")) {
        fileId = url.split("open?id=")[1].split("&")[0];
    } else if (url.includes("/file/d/")) {
        fileId = url.split("/file/d/")[1].split("/")[0];
    } else if (url.includes("uc?id=")) {
        fileId = url.split("uc?id=")[1].split("&")[0];
    }

    if (!fileId) return null;
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
};

export default function PlayerCard({ player, showStatus = true, showBasePrice = false, isLiveView = false, teamName = '' }) {
    if (!player) return null;

    const isSold = player.status === 'SOLD' || player.teamId;

    return (
        <div className={`bg-brand-dark rounded-xl border border-gray-800 overflow-hidden group hover:border-gray-600 transition-colors shadow-lg flex flex-col relative w-full ${isLiveView ? 'h-full' : ''}`}>
            <div className={`aspect-square bg-gray-900 relative border-b border-gray-800 ${isLiveView ? 'flex-shrink-0' : ''}`}>
                {/* SOLD STAMP */}
                {showStatus && isSold && (
                    <div className="absolute top-4 right-4 z-30 flex flex-col items-end transform -rotate-12 pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        <div className="border-[3px] border-red-500 text-red-500 px-3 py-1 font-black shadow-[0_0_15px_rgba(239,68,68,0.4)] tracking-widest uppercase bg-transparent rounded-sm">
                            <span className="text-xl sm:text-2xl m-0 leading-none">SOLD</span>
                        </div>
                        <div className="mt-1 flex flex-col items-end text-right drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {player.soldPrice && (
                                <p className="text-lg font-black text-white m-0 leading-none drop-shadow-md">₹{Number(player.soldPrice).toLocaleString()}</p>
                            )}
                            {player.teamId && teamName && (
                                <p className="text-xs font-bold text-gray-200 mt-1 uppercase max-w-[140px] leading-none drop-shadow-md text-wrap-fix">Team: {teamName}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* AVAILABLE BADGE */}
                {showStatus && !isSold && (
                    <div className="absolute top-3 left-3 z-30 pointer-events-none">
                        <span className="bg-green-500 text-black px-3 py-1 rounded text-xs font-black uppercase tracking-wider shadow-lg">
                            AVAILABLE
                        </span>
                    </div>
                )}

                {player.photoUrl || player.imageUrl ? (() => {
                    const imgUrl = formatDriveImage(player.photoUrl || player.imageUrl);
                    const srcWithCacheBust = imgUrl ? `${imgUrl}${imgUrl.includes('?') ? '&' : '?'}t=${player.id}` : '';
                    return (
                        <img
                            src={srcWithCacheBust}
                            alt={player.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 z-10"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextElementSibling) {
                                    e.target.nextElementSibling.style.display = 'flex';
                                }
                            }}
                        />
                    );
                })() : null}

                <div className={`w-full h-full items-center justify-center absolute top-0 left-0 bg-gray-900 ${player.photoUrl || player.imageUrl ? 'hidden' : 'flex'} z-0`}>
                    <User size={64} className="text-gray-800" />
                </div>
            </div>

            <div className="p-4 flex-1 flex flex-col items-stretch relative z-20 bg-brand-dark">
                <div className="flex-1">
                    <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${player.playingRole === 'Batsman' ? 'text-blue-400' :
                        player.playingRole === 'Bowler' ? 'text-red-400' :
                            (player.playingRole === 'Allrounder' || player.playingRole === 'All Rounder') ? 'text-purple-400' :
                                (player.playingRole === 'Wicket Keeper' || player.playingRole === 'Wicketkeeper') ? 'text-green-400' :
                                    'text-brand-neon'
                        }`}>
                        {player.playingRole || player.role || 'Player'}
                    </p>
                    <h3 className="text-xl font-black uppercase tracking-tighter leading-tight mb-3 text-wrap-fix clamp-2" title={player.name}>{player.name}</h3>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                        <div>
                            <span className="font-bold text-gray-500">AGE:</span> <span className="text-gray-300 font-medium">{player.age || 'NA'}</span>
                        </div>
                        <div>
                            <span className="font-bold text-gray-500">BAT:</span> <span className="text-gray-300 font-medium">{player.battingStyle || 'NA'}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="font-bold text-gray-500">BOWL:</span> <span className="text-gray-300 font-medium">{player.bowlingStyle || 'None'}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                    {showStatus && isSold ? (
                        <>
                            <span className="text-xs text-brand-neon uppercase font-bold tracking-wider">Sold Price</span>
                            <span className="font-black text-brand-neon text-lg leading-none">₹{(Number(player.soldPrice) || 0).toLocaleString()}</span>
                        </>
                    ) : (showBasePrice || !isSold) ? (
                        <>
                            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Base Price</span>
                            <span className="font-black text-gray-300 text-lg leading-none">₹{(Number(player.basePrice) || 0).toLocaleString()}</span>
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
