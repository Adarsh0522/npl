import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { ShieldCheck, ArrowLeft, Users } from 'lucide-react';

export default function TeamDetailsPage() {
    const { teamId } = useParams();
    const navigate = useNavigate();

    const [team, setTeam] = useState(null);
    const [players, setPlayers] = useState([]);
    const [ownerName, setOwnerName] = useState('Not Assigned');
    const [ownerPhoto, setOwnerPhoto] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                const teamDoc = await getDoc(doc(db, 'teams', teamId));
                if (teamDoc.exists()) {
                    const teamData = { id: teamDoc.id, ...teamDoc.data() };
                    setTeam(teamData);

                    // Fetch Owner Info
                    if (teamData.ownerId) {
                        const ownerDoc = await getDoc(doc(db, 'users', teamData.ownerId));
                        if (ownerDoc.exists()) {
                            setOwnerName(ownerDoc.data().name || ownerDoc.data().email);
                            setOwnerPhoto(teamData.ownerPhotoUrl || ownerDoc.data().photoUrl);
                        }
                    }
                } else {
                    console.error("Team not found");
                }
            } catch (error) {
                console.error("Error fetching team:", error);
            }
        };

        const fetchPlayers = () => {
            const q = query(collection(db, 'players'), where('teamId', '==', teamId));
            return onSnapshot(q, (snapshot) => {
                setPlayers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            });
        };

        fetchTeamData();
        const unsubPlayers = fetchPlayers();

        return () => {
            unsubPlayers();
        };
    }, [teamId]);

    if (loading) {
        return <div className="min-h-screen p-8 text-center text-brand-neon animate-pulse font-bold tracking-widest">LOADING TEAM DATA...</div>;
    }

    if (!team) {
        return <div className="min-h-screen p-8 text-center text-red-500 font-bold tracking-widest">TEAM NOT FOUND</div>;
    }

    const totalSpent = players.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
    const remainingPurse = (team.totalBudget || 0) - totalSpent;

    // Find highest bid
    let highestBidPlayer = null;
    let highestBid = 0;
    players.forEach(p => {
        const price = Number(p.soldPrice) || 0;
        if (price > highestBid) {
            highestBid = price;
            highestBidPlayer = p;
        }
    });

    const captain = players.find(p => p.id === team.captainId);
    const captainName = captain ? captain.name : 'Not Assigned';

    // Grouping logic
    const rolesOrder = ['Batsman', 'All Rounder', 'Allrounder', 'Wicket Keeper', 'Wicketkeeper', 'Bowler'];
    const groupedPlayers = players.reduce((acc, p) => {
        // Normalizing roles slightly to ensure they fit in intended buckets
        let role = p.playingRole || 'Unknown';
        if (role === 'Allrounder') role = 'All Rounder';
        if (role === 'Wicketkeeper') role = 'Wicket Keeper';

        if (!acc[role]) acc[role] = [];
        acc[role].push(p);
        return acc;
    }, {});

    const sortedRoles = Object.keys(groupedPlayers).sort((a, b) => {
        const idxA = rolesOrder.indexOf(a);
        const idxB = rolesOrder.indexOf(b);
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    return (
        <div className="min-h-screen bg-brand-darker text-white pb-20 relative overflow-hidden">
            {/* Visual Gradient backdrops */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-neon via-green-400 to-transparent z-20"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-neon/5 rounded-full blur-[120px] pointer-events-none"></div>

            <main className="max-w-7xl mx-auto px-6 lg:px-10 pt-10">

                {/* Back Button */}
                <div className="mb-8 relative z-20">
                    <button
                        onClick={() => navigate('/teams')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition group font-bold tracking-widest uppercase text-xs"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Franchises
                    </button>
                </div>

                {/* Hero Section */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 pb-10 border-b border-gray-800 relative z-10 w-full">
                    {team.logoUrl ? (
                        <img src={team.logoUrl} alt={team.name} className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-full border-4 border-gray-800 bg-black shadow-lg flex-shrink-0" />
                    ) : (
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gray-900 border-4 border-gray-800 flex items-center justify-center shadow-lg flex-shrink-0">
                            <ShieldCheck size={64} className="text-gray-500" />
                        </div>
                    )}

                    <div className="flex-1 min-w-0 w-full text-center md:text-left">
                        <p className="text-brand-neon font-bold tracking-[0.3em] uppercase text-xs md:text-sm mb-2">NPL Auction 2026</p>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter drop-shadow-md leading-tight" style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{team.name}</h1>

                        <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-6 sm:gap-10 mt-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 overflow-hidden border border-gray-700 flex-shrink-0">
                                    {ownerPhoto ? <img src={ownerPhoto} alt="Owner" className="w-full h-full object-cover" /> : 'OWN'}
                                </div>
                                <div className="text-left min-w-0">
                                    <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest font-bold">Owner</p>
                                    <p className="font-bold text-white text-base md:text-lg leading-tight truncate max-w-[200px]">{ownerName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-brand-neon/10 border border-brand-neon/30 flex items-center justify-center text-brand-neon font-black shadow-[0_0_10px_rgba(57,255,20,0.2)] flex-shrink-0">C</div>
                                <div className="text-left min-w-0 flex-1">
                                    <p className="text-[10px] sm:text-xs text-brand-neon uppercase tracking-widest font-bold">Captain</p>
                                    <p className="font-bold text-white text-base md:text-lg leading-tight flex-wrap">{captainName}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team Stats Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 py-10 border-b border-gray-800 relative z-10 w-full">
                    <div className="bg-[#111928] p-6 lg:p-8 flex flex-col justify-center rounded-2xl border border-gray-800/80 hover:bg-gray-800/80 transition-colors">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Squad Size</p>
                        <p className="text-4xl font-black text-white">{players.length} <span className="text-xl text-gray-600">/ {team.maxPlayers || 15}</span></p>
                    </div>
                    <div className="bg-[#111928] p-6 lg:p-8 flex flex-col justify-center rounded-2xl border border-gray-800/80 hover:bg-gray-800/80 transition-colors">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2">Total Spent</p>
                        <p className="text-4xl font-black text-white truncate text-ellipsis">₹{totalSpent.toLocaleString()}</p>
                    </div>
                    <div className="bg-brand-neon/5 p-6 lg:p-8 flex flex-col justify-center rounded-2xl border border-brand-neon/20 shadow-[0_0_20px_rgba(57,255,20,0.05)] hover:border-brand-neon/40 transition-colors">
                        <p className="text-xs text-brand-neon font-bold uppercase tracking-widest mb-2">Remaining Purse</p>
                        <p className="text-4xl font-black text-brand-neon truncate text-ellipsis">₹{remainingPurse.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#111928] p-6 lg:p-8 flex flex-col justify-center rounded-2xl border border-gray-800/80 min-w-0 hover:bg-gray-800/80 transition-colors">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-2 truncate">Highest Bid</p>
                        {highestBidPlayer ? (
                            <div className="min-w-0">
                                <p className="text-3xl lg:text-4xl font-black text-white leading-tight truncate mb-1">₹{highestBid.toLocaleString()}</p>
                                <p className="text-sm text-brand-neon font-bold truncate">{highestBidPlayer.name}</p>
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-gray-600 truncate mt-2">N/A</p>
                        )}
                    </div>
                </div>

                {/* Squad List Section */}
                <div className="py-10 z-10 relative">
                    <h3 className="text-2xl font-black uppercase tracking-widest text-white mb-8 border-l-4 border-brand-neon pl-4">Full Squad</h3>

                    {players.length === 0 ? (
                        <div className="text-center py-24 border border-dashed border-gray-800 rounded-3xl">
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-lg">No players acquired yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
                            {sortedRoles.map(role => (
                                <div key={role} className="bg-gray-900/20 p-6 sm:p-8 rounded-3xl border border-gray-800/40">
                                    <h4 className="text-brand-neon font-black uppercase tracking-widest mb-6 flex items-center justify-between border-b border-gray-800/50 pb-4 text-sm sm:text-base">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 bg-brand-neon rounded-full shadow-[0_0_8px_rgba(57,255,20,0.8)]"></div>
                                            {role}s
                                        </div>
                                        <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded text-xs">Qty: {groupedPlayers[role].length}</span>
                                    </h4>
                                    <div className="space-y-4">
                                        {groupedPlayers[role].map(p => (
                                            <div key={p.id} className="flex justify-between items-center bg-gray-900/60 p-4 sm:p-5 rounded-xl border border-gray-800/80 hover:border-gray-700 transition">
                                                <div className="flex items-center gap-4 sm:gap-5">
                                                    {p.photoUrl ? (
                                                        <img src={p.photoUrl} alt={p.name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border border-gray-700 bg-black shadow-md" />
                                                    ) : (
                                                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 border border-gray-700 shadow-md">
                                                            <Users size={24} />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white text-base sm:text-lg tracking-tight flex items-center gap-2">
                                                            {p.name}
                                                            {p.id === team.captainId && (
                                                                <span className="text-[10px] bg-brand-neon text-black px-1.5 py-0.5 rounded font-black tracking-wider uppercase shadow-[0_0_5px_rgba(57,255,20,0.5)]">C</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right pl-4 border-l border-gray-800/50 min-w-fit">
                                                    <span className="text-[10px] sm:text-xs text-gray-500 font-bold tracking-widest block leading-none mb-1.5">PRICE</span>
                                                    <span className="font-black text-brand-neon text-lg sm:text-xl leading-none">₹{(Number(p.soldPrice) || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
