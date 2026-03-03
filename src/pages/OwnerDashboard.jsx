import React, { useEffect, useState } from 'react';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useAuction } from '../context/AuctionContext';
import { useAuctionTimer } from '../hooks/useAuctionTimer';
import { useAuctionResolver } from '../hooks/useAuctionResolver';
import { LiveBidButton } from '../components/owner/LiveBidButton';
import { Wallet, Users, AlertCircle, Download, Trophy, Clock } from 'lucide-react';
import PlayerCard from '../components/PlayerCard';
import { AuctionTabs } from '../components/AuctionTabs';

const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function OwnerDashboard() {
    const { userTeamId, loading: authLoading } = useAuth();
    const { auctionState } = useAuction();
    const { timeLeft } = useAuctionTimer();
    useAuctionResolver(); // Auto-resolve from any page
    const [teamData, setTeamData] = useState(null);
    const [squad, setSquad] = useState([]);
    const [livePlayer, setLivePlayer] = useState(null);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userTeamId) {
            if (loading) setLoading(false);
            return;
        }

        const teamRef = doc(db, 'teams', userTeamId);
        const playersRef = collection(db, 'players');

        const unsubscribeTeam = onSnapshot(teamRef, (docSnap) => {
            if (docSnap.exists()) {
                setTeamData({ id: docSnap.id, ...docSnap.data() });
            }
        });

        const qSquad = query(playersRef, where('teamId', '==', userTeamId));
        const unsubscribeSquad = onSnapshot(qSquad, (snapshot) => {
            const players = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setSquad(players);
            setLoading(false);
        });

        const qLive = query(playersRef, where('status', '==', 'LIVE'));
        const unsubscribeLive = onSnapshot(qLive, (snapshot) => {
            if (!snapshot.empty) {
                setLivePlayer({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            } else {
                setLivePlayer(null);
            }
        });

        const unsubscribeTeams = onSnapshot(collection(db, 'teams'), (snap) => {
            setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => {
            unsubscribeTeam();
            unsubscribeSquad();
            unsubscribeLive();
            unsubscribeTeams();
        };
    }, [userTeamId]);

    const handleExportTeam = () => {
        if (!teamData || squad.length === 0) {
            alert("No squad data available to export.");
            return;
        }

        let printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write('<html><head><title>Team Squad Export</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f4f4f4; text-transform: uppercase; font-size: 14px; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .total { font-weight: bold; font-size: 16px; margin-top: 20px; text-align: right; }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write(`
            <div class="header-info">
                <div>
                    <h1>${teamData.name} - Squad Roster</h1>
                </div>
                <div>
                    <p>Total Budget: ₹${(teamData.totalBudget || 0).toLocaleString()}</p>
                    <p>Remaining Purse: ₹${(teamData.totalBudget - squad.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0)).toLocaleString()}</p>
                    <p>Squad Count: ${squad.length} / ${teamData.maxPlayers}</p>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Player Name</th>
                        <th>Role</th>
                        <th>Bought For</th>
                    </tr>
                </thead>
                <tbody>
                    ${squad.map(p => `
                        <tr>
                            <td>${p.name} ${p.id === teamData.captainId ? '(Captain)' : ''}</td>
                            <td>${p.playingRole || 'Unknown'}</td>
                            <td>₹${(Number(p.soldPrice) || 0).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    };

    if (authLoading || loading) {
        return <div className="p-6 text-center text-white">Loading Owner Dashboard...</div>;
    }

    if (!userTeamId || !teamData) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-6 text-white text-center">
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-xl max-w-md">
                    <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">No Team Assigned</h2>
                    <p className="text-gray-400">Your account is not assigned to any team. Please ask the organizer to assign you.</p>
                </div>
            </div>
        );
    }

    const totalSpent = squad.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
    const remainingWallet = (teamData.totalBudget || 0) - totalSpent;
    const isLive = auctionState?.status === 'LIVE' && livePlayer;
    const leadingTeamName = auctionState?.leadingTeamId
        ? teams.find(t => t.id === auctionState.leadingTeamId)?.name || 'Unknown'
        : null;
    const isMyTeamLeading = auctionState?.leadingTeamId === userTeamId;

    return (
        <div className="min-h-screen bg-brand-darker text-white p-4 sm:p-6 pb-24 lg:pb-6 relative overflow-hidden">
            <div className="absolute top-20 right-20 w-64 h-64 bg-brand-neon/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto space-y-6 relative z-10">
                <header className="border-b border-gray-800 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between">
                    <div className="flex items-center space-x-4">
                        {teamData.logoUrl && (
                            <img src={teamData.logoUrl} alt="Logo" className="w-16 h-16 rounded-full border-2 border-brand-neon object-cover bg-black" />
                        )}
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">{teamData.name}</h1>
                            <p className="text-brand-neon font-bold tracking-widest mt-1 text-sm">OWNER DASHBOARD</p>
                        </div>
                    </div>

                    <button onClick={handleExportTeam} className="mt-4 md:mt-0 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 flex items-center transition text-sm font-bold uppercase tracking-wider">
                        <Download size={16} className="mr-2 text-brand-neon" />
                        Export Squad
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Stats Cards */}
                    <div className="space-y-6">
                        <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 flex items-center justify-between shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-neon/5 rounded-bl-full blur-2xl"></div>
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Available Wallet</p>
                                <p className={`text-4xl font-black tracking-tighter ${remainingWallet < 0 ? 'text-red-500' : 'text-brand-neon'}`}>
                                    ₹{remainingWallet.toLocaleString()}
                                </p>
                                <div className="mt-2 flex space-x-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <span>Total: ₹{(teamData.totalBudget || 0).toLocaleString()}</span>
                                    <span>Spent: ₹{totalSpent.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="p-4 bg-brand-neon/10 rounded-full relative z-10">
                                <Wallet size={32} className="text-brand-neon" />
                            </div>
                        </div>

                        <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 flex flex-col shadow-lg max-h-[400px]">
                            <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
                                <div>
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">Squad Strength</p>
                                    <p className="text-2xl font-black text-white tracking-tighter">
                                        {squad.length} <span className="text-lg text-gray-600">/ {teamData.maxPlayers || 15}</span>
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-800 rounded-full">
                                    <Users size={24} className="text-gray-400" />
                                </div>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                                {squad.length === 0 ? (
                                    <div className="text-center text-gray-500 font-bold uppercase py-8 tracking-widest">No players yet</div>
                                ) : (
                                    <div className="space-y-3">
                                        {squad.map(p => (
                                            <div key={p.id} className="flex justify-between items-center bg-gray-900/50 p-3 rounded border border-gray-800">
                                                <div className="flex items-center">
                                                    <div>
                                                        <p className="font-bold text-white text-sm uppercase flex items-center">
                                                            {p.name}
                                                            {p.id === teamData.captainId && (
                                                                <span className="ml-2 bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded font-black tracking-widest">C</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-brand-neon font-bold tracking-wider uppercase mt-0.5">{p.playingRole}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-white text-lg tracking-tight">₹{(Number(p.soldPrice) || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bidding Area */}
                    <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 shadow-2xl flex flex-col justify-between min-h-[500px] relative border-t-2 border-t-brand-neon/50 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-brand-neon/5 to-transparent pointer-events-none"></div>

                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center">
                                    <span className={`w-2 h-2 rounded-full mr-2 ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`}></span>
                                    Live Action
                                </h2>

                                {/* Timer Display */}
                                {isLive && timeLeft !== null && (
                                    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${timeLeft <= 10
                                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                        : 'bg-gray-900 border-gray-700 text-white'
                                        }`}>
                                        <Clock size={16} className={timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-brand-neon'} />
                                        <span className="text-2xl font-black tracking-tighter tabular-nums">
                                            {formatTime(timeLeft)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {isLive ? (
                                <div className="mb-8">
                                    <div className="max-w-xs mx-auto">
                                        <PlayerCard player={livePlayer} showStatus={false} isLiveView={true} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Base Price</p>
                                            <p className="text-xl font-black text-gray-300">₹{(Number(livePlayer.basePrice) || 1000).toLocaleString()}</p>
                                        </div>
                                        <div className="text-center border-l border-gray-800">
                                            <p className="text-xs font-bold text-brand-neon uppercase tracking-widest mb-1">Leading Bid</p>
                                            <p className="text-3xl font-black text-white leading-none">₹{(auctionState.currentBid || 0).toLocaleString()}</p>
                                        </div>
                                        {leadingTeamName && (
                                            <div className="col-span-2 text-center border-t border-gray-800 pt-3">
                                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Leading Team</p>
                                                <p className={`text-sm font-black uppercase tracking-wider ${isMyTeamLeading ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {isMyTeamLeading ? '✅ YOUR TEAM' : leadingTeamName}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-900 border border-gray-800 rounded-xl mb-8 flex-1">
                                    <Trophy size={48} className="text-gray-700 mb-4" />
                                    <p className="text-xl font-black text-gray-600 uppercase tracking-widest">Auction Not Active</p>
                                </div>
                            )}
                        </div>

                        <LiveBidButton remainingWallet={remainingWallet} />
                    </div>

                </div>

                {/* Tabs: Upcoming / Sold / Unsold */}
                <div className="bg-brand-dark rounded-xl border border-gray-800 p-4 sm:p-6 shadow-xl">
                    <AuctionTabs ownerTeamId={userTeamId} teams={teams} />
                </div>
            </div>
        </div>
    );
}
