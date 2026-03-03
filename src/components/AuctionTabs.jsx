import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { BidHistory } from './BidHistory';
import { User } from 'lucide-react';

const formatDriveImage = (url) => {
    if (!url) return null;
    if (!url.includes("drive.google.com")) return url;
    let fileId = null;
    if (url.includes("open?id=")) fileId = url.split("open?id=")[1].split("&")[0];
    else if (url.includes("/file/d/")) fileId = url.split("/file/d/")[1].split("/")[0];
    else if (url.includes("uc?id=")) fileId = url.split("uc?id=")[1].split("&")[0];
    if (!fileId) return null;
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
};

/**
 * Tabs: Upcoming | Sold | Unsold
 * Used by both LiveAuction and OwnerDashboard.
 * 
 * Props:
 *   ownerTeamId - if set, highlights "My Team" in Sold tab
 *   teams - array of team objects for name resolution
 */
export const AuctionTabs = ({ ownerTeamId = null, teams = [] }) => {
    const [activeTab, setActiveTab] = useState('upcoming');
    const [allPlayers, setAllPlayers] = useState([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'players'), (snap) => {
            setAllPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const upcoming = allPlayers.filter(p => p.status === 'READY');
    const sold = allPlayers.filter(p => p.status === 'SOLD');
    const unsold = allPlayers.filter(p => p.status === 'UNSOLD');

    const getTeamName = (teamId) => {
        if (!teamId) return 'Unknown';
        return teams.find(t => t.id === teamId)?.name || 'Unknown';
    };

    // For owner dashboard: split sold into "my team" and "others"
    const myTeamSold = ownerTeamId ? sold.filter(p => p.teamId === ownerTeamId) : [];
    const otherSold = ownerTeamId ? sold.filter(p => p.teamId !== ownerTeamId) : sold;

    const tabs = [
        { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
        { id: 'sold', label: 'Sold', count: sold.length },
        { id: 'unsold', label: 'Unsold', count: unsold.length },
    ];

    return (
        <div className="w-full">
            {/* Tab Headers */}
            <div className="flex overflow-x-auto hide-scrollbar border-b border-gray-800 mb-4 gap-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-shrink-0 px-4 py-2.5 font-bold text-xs uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                            ? tab.id === 'sold'
                                ? 'border-green-500 text-green-400'
                                : tab.id === 'unsold'
                                    ? 'border-red-500 text-red-400'
                                    : 'border-brand-neon text-brand-neon'
                            : 'border-transparent text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        {tab.label}
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-black ${activeTab === tab.id ? 'bg-white/10' : 'bg-gray-800'
                            }`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                {activeTab === 'upcoming' && (
                    <div className="space-y-2">
                        {upcoming.length === 0 ? (
                            <EmptyState text="No upcoming players" />
                        ) : (
                            upcoming.map(p => (
                                <CompactPlayerCard key={p.id} player={p} variant="upcoming" />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'sold' && (
                    <div className="space-y-3">
                        {sold.length === 0 ? (
                            <EmptyState text="No players sold yet" />
                        ) : (
                            <>
                                {/* Owner's team sold players first */}
                                {myTeamSold.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-[10px] font-black text-brand-neon uppercase tracking-widest mb-2 flex items-center">
                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-neon mr-1.5"></span>
                                            Your Team
                                        </p>
                                        <div className="space-y-2">
                                            {myTeamSold.map(p => (
                                                <SoldPlayerCard key={p.id} player={p} teamName={getTeamName(p.teamId)} isMyTeam={true} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Other teams */}
                                {otherSold.length > 0 && (
                                    <div>
                                        {ownerTeamId && myTeamSold.length > 0 && (
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Other Teams</p>
                                        )}
                                        <div className="space-y-2">
                                            {otherSold.map(p => (
                                                <SoldPlayerCard key={p.id} player={p} teamName={getTeamName(p.teamId)} isMyTeam={false} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'unsold' && (
                    <div className="space-y-2">
                        {unsold.length === 0 ? (
                            <EmptyState text="No unsold players" />
                        ) : (
                            unsold.map(p => (
                                <CompactPlayerCard key={p.id} player={p} variant="unsold" />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

/** Compact card for Upcoming and Unsold tabs */
const CompactPlayerCard = ({ player, variant = 'upcoming' }) => {
    const imgSrc = formatDriveImage(player.photoUrl || player.imageUrl);

    return (
        <div className="flex items-center gap-3 p-3 bg-brand-dark rounded-lg border border-gray-800 hover:border-gray-700 transition group">
            {/* Photo */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-900 border border-gray-700 flex-shrink-0 flex items-center justify-center">
                {imgSrc ? (
                    <img src={imgSrc} alt={player.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                    <User size={18} className="text-gray-700" />
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm uppercase tracking-tight text-wrap-fix clamp-2">{player.name}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${player.playingRole === 'Batsman' ? 'text-blue-400' :
                    player.playingRole === 'Bowler' ? 'text-red-400' :
                        (player.playingRole === 'Allrounder' || player.playingRole === 'All Rounder') ? 'text-purple-400' :
                            (player.playingRole === 'Wicket Keeper' || player.playingRole === 'Wicketkeeper') ? 'text-green-400' :
                                'text-gray-400'
                    }`}>
                    {player.playingRole || 'Player'}
                </p>
            </div>

            {/* Right side */}
            <div className="text-right flex-shrink-0 flex items-center gap-2">
                <span className="font-black text-gray-300 text-sm">₹{(Number(player.basePrice) || 0).toLocaleString()}</span>
                {variant === 'unsold' && (
                    <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-wider rounded">
                        Unsold
                    </span>
                )}
            </div>
        </div>
    );
};

/** Sold player card with team, sold price, and bid history */
const SoldPlayerCard = ({ player, teamName, isMyTeam = false }) => {
    const imgSrc = formatDriveImage(player.photoUrl || player.imageUrl);

    return (
        <div className={`p-3 rounded-lg border transition ${isMyTeam
            ? 'bg-brand-neon/5 border-brand-neon/20'
            : 'bg-brand-dark border-gray-800'
            }`}>
            <div className="flex items-center gap-3">
                {/* Photo */}
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-900 border border-gray-700 flex-shrink-0 flex items-center justify-center">
                    {imgSrc ? (
                        <img src={imgSrc} alt={player.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                    ) : (
                        <User size={18} className="text-gray-700" />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm uppercase tracking-tight text-wrap-fix clamp-2">{player.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${player.playingRole === 'Batsman' ? 'text-blue-400' :
                            player.playingRole === 'Bowler' ? 'text-red-400' :
                                (player.playingRole === 'Allrounder' || player.playingRole === 'All Rounder') ? 'text-purple-400' :
                                    'text-gray-400'
                            }`}>
                            {player.playingRole || 'Player'}
                        </span>
                        <span className="text-gray-600">•</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-wrap-fix">{teamName}</span>
                    </div>
                </div>

                {/* Sold badge + price */}
                <div className="text-right flex-shrink-0 flex flex-col items-end">
                    <span className="px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-black uppercase tracking-wider rounded mb-1">
                        Sold
                    </span>
                    <span className="font-black text-brand-neon text-sm">₹{(Number(player.soldPrice) || 0).toLocaleString()}</span>
                </div>
            </div>

            {/* Bid History */}
            <BidHistory bidHistory={player.bidHistory} />
        </div>
    );
};

/** Empty state placeholder */
const EmptyState = ({ text }) => (
    <div className="flex items-center justify-center py-12 text-gray-600 font-bold uppercase tracking-widest text-sm">
        {text}
    </div>
);
