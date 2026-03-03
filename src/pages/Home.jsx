import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { Users, UserSquare, ShieldCheck, Trophy, ArrowRight } from 'lucide-react';

export default function Home() {
    const [stats, setStats] = useState({ teams: 0, players: 0 });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const tSnap = await getDocs(collection(db, 'teams'));
                const pSnap = await getDocs(collection(db, 'players'));
                setStats({ teams: tSnap.size, players: pSnap.size });
            } catch (err) {
                console.warn("Could not fetch stats yet", err);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="min-h-screen bg-brand-darker text-white p-4 sm:p-6 lg:p-8 relative overflow-hidden">
            {/* Decorative background effects */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-neon/10 rounded-bl-full blur-[100px] mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-accent/5 rounded-tr-full blur-[100px] mix-blend-screen pointer-events-none"></div>

            <div className="max-w-7xl mx-auto space-y-12 relative z-10 pt-8 lg:pt-6">

                {/* Hero Section */}
                <section className="text-center space-y-6">
                    <div className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-dark rounded-full border border-gray-800">
                        <Trophy size={16} className="text-brand-neon" />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-300">Season 2026</span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white drop-shadow-2xl">
                        Narsinge <br /><span className="text-brand-neon italic">Premier League</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-400 font-medium max-w-2xl mx-auto">
                        Experience the thrill of the ultimate cricket auction. Watch teams battle for the best talent in real-time.
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
                        <Link to="/live" className="w-full sm:w-auto px-8 py-4 bg-brand-neon text-black font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all duration-300 shadow-[0_0_20px_rgba(57,255,20,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-black animate-pulse mr-3"></span>
                            Watch Live Auction
                        </Link>
                        <Link to="/teams" className="w-full sm:w-auto px-8 py-4 bg-brand-dark border border-gray-700 text-white font-bold uppercase tracking-widest rounded-lg hover:bg-gray-800 hover:border-gray-500 transition-colors flex items-center justify-center">
                            View Teams
                        </Link>
                    </div>
                </section>

                {/* Quick Stats Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16 max-w-4xl mx-auto">
                    {/* Teams Stat */}
                    <Link to="/teams" className="group p-8 bg-brand-dark rounded-2xl border border-gray-800 hover:border-brand-neon/50 transition-colors shadow-2xl relative overflow-hidden flex items-center justify-between">
                        <div className="absolute inset-0 bg-gradient-to-r from-brand-neon/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Franchises</p>
                            <p className="text-5xl font-black text-white">{stats.teams}</p>
                        </div>
                        <div className="p-4 bg-gray-900 rounded-full border border-gray-800 group-hover:border-brand-neon transition-colors">
                            <ShieldCheck size={32} className="text-brand-neon" />
                        </div>
                    </Link>

                    {/* Players Stat */}
                    <Link to="/players" className="group p-8 bg-brand-dark rounded-2xl border border-gray-800 hover:border-brand-accent/50 transition-colors shadow-2xl relative overflow-hidden flex items-center justify-between">
                        <div className="absolute inset-0 bg-gradient-to-r from-brand-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Players Registered</p>
                            <p className="text-5xl font-black text-white">{stats.players}</p>
                        </div>
                        <div className="p-4 bg-gray-900 rounded-full border border-gray-800 group-hover:border-brand-accent transition-colors">
                            <UserSquare size={32} className="text-brand-accent" />
                        </div>
                    </Link>
                </section>

                {/* Sponsor/Tournament Details placeholder */}
                <section className="mt-16 text-center max-w-3xl mx-auto p-8 rounded-2xl border border-gray-800/50 bg-brand-darker/50 backdrop-blur-sm">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Venue & Details</h3>
                    <p className="text-gray-400">The 2026 Season brings more action, bigger wallets, and stricter rules. Stay tuned to the live broadcast for minute-by-minute updates of the player base.</p>
                </section>

            </div>
        </div>
    );
}
