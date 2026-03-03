import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Teams() {
    const [teams, setTeams] = useState([]);
    const [allPlayers, setAllPlayers] = useState([]);
    const [owners, setOwners] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
            const tData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tData.sort((a, b) => a.name.localeCompare(b.name));
            setTeams(tData);
            setLoading(false);
        });

        const unsubPlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
            setAllPlayers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const fetchOwners = async () => {
            try {
                const uSnap = await getDocs(collection(db, 'users'));
                const ownerData = uSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(u => u.role === 'owner');
                setOwners(ownerData);
            } catch (err) {
                console.warn(err);
            }
        };
        fetchOwners();

        return () => {
            unsubTeams();
            unsubPlayers();
        };
    }, []);

    const getTeamStats = (team) => {
        const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
        const totalSpent = teamPlayers.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
        const remainingPurse = (team.totalBudget || 0) - totalSpent;

        let captainName = 'Not Assigned';
        if (team.captainId) {
            const c = teamPlayers.find(p => p.id === team.captainId);
            if (c) captainName = c.name;
        }

        const owner = owners.find(o => o.id === team.ownerId);
        const ownerName = owner ? (owner.name || owner.email) : 'Not Assigned';

        return { squadCount: teamPlayers.length, remainingPurse, captainName, ownerName };
    };

    if (loading) {
        return <div className="min-h-screen p-8 text-center text-brand-neon animate-pulse font-bold tracking-widest">LOADING TEAMS...</div>;
    }

    return (
        <div className="min-h-screen bg-brand-darker text-white p-4 md:p-8 relative">
            <div className="max-w-7xl mx-auto space-y-8">
                <header className="border-b border-gray-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">Franchises</h1>
                        <p className="text-gray-400 mt-2 font-medium">Meet the competing teams of NPL 2026</p>
                    </div>
                </header>

                {teams.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest border border-dashed border-gray-800 rounded-2xl">
                        No teams registered yet
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teams.map(team => {
                            const stats = getTeamStats(team);
                            return (
                                <div
                                    key={team.id}
                                    onClick={() => navigate(`/teams/${team.id}`)}
                                    className="bg-brand-dark rounded-xl border border-gray-800 p-5 shadow-lg relative overflow-hidden group cursor-pointer hover:border-brand-neon transition duration-300 flex flex-col gap-4"
                                >
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-neon/5 rounded-bl-[100px] pointer-events-none group-hover:bg-brand-neon/10 transition-colors duration-300"></div>

                                    {/* Top Row: Logo & Name */}
                                    <div className="flex items-center space-x-4 relative z-10">
                                        {team.logoUrl ? (
                                            <img src={team.logoUrl} alt={team.name} className="w-16 h-16 object-cover rounded-full bg-gray-900 border border-gray-700" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center">
                                                <ShieldCheck size={28} className="text-gray-500" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-brand-neon/80 font-bold tracking-widest text-[10px] uppercase mb-0.5">NPL 26</p>
                                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter leading-tight" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{team.name}</h2>
                                        </div>
                                    </div>

                                    {/* Middle Section: Owner & Captain */}
                                    <div className="bg-gray-900/40 rounded-lg p-3 border border-gray-800/50 flex flex-col gap-2 relative z-10">
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest text-left">Owner</p>
                                            <p className="text-sm font-medium text-gray-200 truncate">{stats.ownerName}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-brand-neon/20 flex items-center justify-center border border-brand-neon/40 text-[10px] text-brand-neon font-black">C</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] text-brand-neon/80 uppercase font-bold tracking-widest text-left">Captain</p>
                                                <p className="text-sm font-medium text-white truncate">{stats.captainName}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Section: Squad Size & Remaining Purse */}
                                    <div className="flex justify-between items-center border-t border-gray-800 pt-3 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Squad Size</p>
                                            <p className="text-lg font-black text-white">{stats.squadCount} <span className="text-xs text-gray-600">/ {team.maxPlayers || 15}</span></p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Remaining Purse</p>
                                            <p className="text-lg font-black text-brand-neon truncate">₹{stats.remainingPurse.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
