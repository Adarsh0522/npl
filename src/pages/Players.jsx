import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Search, Filter } from 'lucide-react';
import PlayerCard from '../components/PlayerCard';

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

export default function Players() {
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const q = query(collection(db, 'players'), orderBy('name', 'asc'));
                const querySnapshot = await getDocs(q);
                const pData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPlayers(pData);

                const tQuery = await getDocs(collection(db, 'teams'));
                setTeams(tQuery.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (err) {
                console.error("Error fetching players", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPlayers();
    }, []);

    const getTeamName = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : 'Unknown Team';
    };

    const filteredPlayers = players.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const isSold = p.status === 'SOLD' || p.teamId;

        let matchFilter = true;
        if (filter === 'sold') {
            matchFilter = isSold;
        } else if (filter === 'Batsman') {
            matchFilter = p.playingRole === 'Batsman';
        } else if (filter === 'Bowler') {
            matchFilter = p.playingRole === 'Bowler';
        } else if (filter === 'Allrounder') {
            matchFilter = p.playingRole === 'Allrounder' || p.playingRole === 'All Rounder';
        } else if (filter === 'Wicketkeeper') {
            matchFilter = p.playingRole === 'Wicketkeeper' || p.playingRole === 'Wicket Keeper';
        }

        return matchSearch && matchFilter;
    });

    if (loading) {
        return <div className="min-h-screen p-8 text-center text-brand-neon animate-pulse font-bold tracking-widest">LOADING PLAYERS...</div>;
    }

    return (
        <div className="min-h-screen bg-brand-darker text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                <header className="border-b border-gray-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">Player Pool</h1>
                        <p className="text-gray-400 mt-2 font-medium">All registered players for NPL 2026</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search player..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 pl-10 pr-4 py-3 bg-brand-dark border border-gray-700 rounded-lg text-white focus:outline-none focus:border-brand-neon placeholder-gray-600"
                            />
                        </div>
                        <div className="relative border border-gray-700 rounded-lg bg-brand-dark focus-within:border-brand-neon">
                            <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="w-full sm:w-48 pl-10 pr-8 py-3 bg-transparent text-white appearance-none outline-none cursor-pointer"
                            >
                                <option className="bg-brand-dark text-white" value="all">All Status</option>
                                <option className="bg-brand-dark text-white" value="sold">Sold</option>
                                <option className="bg-brand-dark text-white" value="Batsman">Batsman</option>
                                <option className="bg-brand-dark text-white" value="Bowler">Bowler</option>
                                <option className="bg-brand-dark text-white" value="Allrounder">All Rounder</option>
                                <option className="bg-brand-dark text-white" value="Wicketkeeper">Wicket Keeper</option>
                            </select>
                        </div>
                    </div>
                </header>

                {filteredPlayers.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 font-bold uppercase tracking-widest border border-dashed border-gray-800 rounded-2xl">
                        No players found
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {filteredPlayers.map(player => (
                            <PlayerCard
                                key={player.id}
                                player={player}
                                teamName={player.teamId ? getTeamName(player.teamId) : ''}
                                showStatus={true}
                                showBasePrice={true}
                            />
                        ))}
                    </div>
                )}

            </div>
        </div >
    );
}
