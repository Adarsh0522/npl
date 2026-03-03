import React, { useEffect, useState } from 'react';
import { doc, collection, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuction } from '../context/AuctionContext';
import { useAuctionTimer } from '../hooks/useAuctionTimer';
import { useAuctionResolver } from '../hooks/useAuctionResolver';
import { Trophy, Clock } from 'lucide-react';
import PlayerCard from '../components/PlayerCard';
import { AuctionTabs } from '../components/AuctionTabs';
import SoldAnnouncement from '../components/announcements/SoldAnnouncement';
import UnsoldAnnouncement from '../components/announcements/UnsoldAnnouncement';

const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function LiveAuction() {
    const { auctionState, loading } = useAuction();
    const { timeLeft } = useAuctionTimer();
    useAuctionResolver(); // Auto-resolve from any page
    const [playerInfo, setPlayerInfo] = useState(null);
    const [leadingTeam, setLeadingTeam] = useState(null);
    const [teams, setTeams] = useState([]);
    const [liveUserCount, setLiveUserCount] = useState(0);

    // Live Viewer Count (Presence System)
    useEffect(() => {
        const sessionId = crypto.randomUUID();
        const presenceRef = doc(db, "auctionPresence", sessionId);

        // 1. Add document on mount
        setDoc(presenceRef, {
            joinedAt: serverTimestamp(),
            lastActiveAt: serverTimestamp()
        }).catch(err => console.error("Presence error:", err));

        // 2. Heartbeat every 15 seconds
        const heartbeat = setInterval(() => {
            updateDoc(presenceRef, {
                lastActiveAt: serverTimestamp()
            }).catch(err => console.error("Heartbeat error:", err));
        }, 15000);

        // 3. Listen to live users
        const unsubPresence = onSnapshot(collection(db, "auctionPresence"), (snap) => {
            setLiveUserCount(snap.size);
        });

        // 4. Cleanup on unmount
        return () => {
            clearInterval(heartbeat);
            unsubPresence();
            deleteDoc(presenceRef).catch(err => console.error("Cleanup error:", err));
        };
    }, []);

    // Subscribe to current player via onSnapshot (real-time)
    useEffect(() => {
        if (auctionState?.currentPlayerId && (auctionState?.status === 'LIVE' || auctionState?.status === 'ANNOUNCING')) {
            const unsub = onSnapshot(doc(db, 'players', auctionState.currentPlayerId), (docSnap) => {
                if (docSnap.exists()) {
                    setPlayerInfo({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setPlayerInfo(null);
                }
            });
            return () => unsub();
        } else {
            setPlayerInfo(null);
        }
    }, [auctionState?.currentPlayerId, auctionState?.status]);

    // Subscribe to leading team via onSnapshot (real-time)
    useEffect(() => {
        if (auctionState?.leadingTeamId) {
            const unsub = onSnapshot(doc(db, 'teams', auctionState.leadingTeamId), (docSnap) => {
                if (docSnap.exists()) {
                    setLeadingTeam(docSnap.data());
                } else {
                    setLeadingTeam(null);
                }
            });
            return () => unsub();
        } else {
            setLeadingTeam(null);
        }
    }, [auctionState?.leadingTeamId]);

    // Subscribe to all teams for name resolution
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'teams'), (snap) => {
            setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    if (loading) {
        return <div className="min-h-screen bg-brand-darker flex items-center justify-center text-brand-neon animate-pulse font-black tracking-widest text-2xl">LOADING AUCTION...</div>;
    }

    const isLive = auctionState?.status === 'LIVE' && playerInfo;
    const currentBid = auctionState?.currentBid || auctionState?.basePrice || playerInfo?.basePrice || 1000;

    // Announcement state: show when ANNOUNCING OR when player matches last resolved
    const isShowingAnnouncement = auctionState?.status === 'ANNOUNCING'
        || (auctionState?.currentPlayerId
            && auctionState?.lastResolvedPlayerId
            && auctionState.currentPlayerId === auctionState.lastResolvedPlayerId);
    const announcementStatus = auctionState?.lastResolvedStatus; // 'SOLD' or 'UNSOLD'

    return (
        <div className="min-h-screen bg-brand-darker text-white p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start overflow-hidden relative">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-neon/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-accent/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>



            {isShowingAnnouncement ? (
                /* Announcement overlay — SOLD or UNSOLD */
                <div className="flex-1 flex flex-col items-center justify-center text-center z-10 w-full min-h-[60vh]">
                    <div className="w-full max-w-2xl mx-auto bg-brand-dark rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
                        {announcementStatus === 'SOLD' ? (
                            <SoldAnnouncement
                                playerName={playerInfo?.name}
                                soldPrice={auctionState?.currentBid}
                                teamName={teams.find(t => t.id === auctionState?.leadingTeamId)?.name}
                                bidHistory={playerInfo?.bidHistory || []}
                            />
                        ) : (
                            <UnsoldAnnouncement
                                playerName={playerInfo?.name}
                                basePrice={playerInfo?.basePrice}
                            />
                        )}
                    </div>
                </div>
            ) : !isLive ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center z-10 w-full h-full min-h-[60vh]">
                    <Trophy size={80} className={`mb-6 ${auctionState?.status === 'PAUSED' ? 'text-yellow-500' : 'text-gray-600'} mx-auto`} />
                    <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white mb-4">
                        {auctionState?.status === 'PAUSED' ? 'AUCTION PAUSED' :
                            auctionState?.status === 'ENDED' ? 'AUCTION ENDED' :
                                'AUCTION NOT STARTED'}
                    </h1>
                    <p className="text-gray-400 text-lg md:text-2xl font-medium tracking-wide">
                        {auctionState?.status === 'ENDED' ? 'Thank you for joining us!' : 'Stay tuned for the next player...'}
                    </p>
                </div>
            ) : (
                <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 z-10 mt-4 md:mt-12 items-center lg:items-stretch">

                    {/* Left: Player Card */}
                    <div className="flex-1 flex flex-col items-center relative w-full lg:w-1/2">
                        <div className="w-full max-w-md">
                            <PlayerCard
                                key={auctionState?.currentPlayerId || 'empty'}
                                player={playerInfo}
                                showStatus={false}
                                showBasePrice={true}
                                isLiveView={true}
                            />
                        </div>
                    </div>

                    {/* Right: Bidding Info & Timer */}
                    <div className="flex-1 flex flex-col justify-center space-y-8 w-full">

                        <div className="flex justify-between bg-brand-dark/80 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm shadow-xl flex-col sm:flex-row gap-4 sm:gap-0 items-center">
                            <div className="flex items-center bg-gray-900 px-6 py-3 rounded-lg border border-gray-700 shadow-inner w-full sm:w-auto justify-center">
                                <Clock size={28} className={timeLeft !== null && timeLeft <= 5 ? "text-red-500 animate-pulse" : "text-brand-neon"} />
                                <span className={`ml-4 text-5xl font-black tracking-tighter tabular-nums ${timeLeft !== null && timeLeft <= 5 ? 'text-red-500' : 'text-white'}`}>
                                    {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                                </span>
                            </div>
                            <div className="text-center sm:text-right w-full sm:w-auto">
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Base Price</p>
                                <p className="text-3xl font-black text-gray-300">₹{(Number(playerInfo?.basePrice) || 1000).toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center p-8 bg-brand-dark rounded-3xl border-2 border-brand-neon/30 shadow-[0_0_50px_rgba(59,255,20,0.1)] relative overflow-hidden flex-grow min-h-[250px]">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-neon/10 rounded-bl-full blur-3xl"></div>
                            <p className="text-sm font-bold text-brand-neon uppercase tracking-widest mb-2 flex items-center">
                                <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse mr-2"></span>
                                Current Bid
                            </p>
                            <h1 className="text-7xl md:text-8xl lg:text-9xl font-black text-white tracking-tighter drop-shadow-2xl transition-all duration-300">
                                ₹{currentBid.toLocaleString()}
                            </h1>
                        </div>

                        <div className="flex flex-col items-center justify-center p-6 bg-brand-dark/80 rounded-2xl border border-gray-800 shadow-xl min-h-[140px]">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Leading Team</p>
                            {leadingTeam ? (
                                <div className="flex items-center space-x-4 max-w-full">
                                    {leadingTeam.logoUrl ? (
                                        <img src={leadingTeam.logoUrl} alt="Logo" className="w-14 h-14 object-contain rounded-full bg-black border-2 border-brand-neon flex-shrink-0" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full bg-gray-900 border-2 border-brand-neon flex items-center justify-center flex-shrink-0">
                                            <Trophy size={20} className="text-brand-neon" />
                                        </div>
                                    )}
                                    <h2 className="text-3xl sm:text-4xl font-black text-brand-neon uppercase tracking-tight text-wrap-fix clamp-2">{leadingTeam.name}</h2>
                                </div>
                            ) : (
                                <div className="flex items-center text-gray-600 space-x-3">
                                    <Trophy size={28} />
                                    <span className="text-2xl font-black tracking-wide uppercase">No bids yet</span>
                                </div>
                            )}
                        </div>

                    </div>

                </div>
            )}

            {/* Tabs Section: Upcoming / Sold / Unsold */}
            <div className="w-full max-w-6xl mx-auto mt-10 z-10">
                <div className="bg-brand-dark rounded-xl border border-gray-800 p-4 sm:p-6 shadow-xl">
                    <AuctionTabs teams={teams} />
                </div>
            </div>
        </div>
    );
}
