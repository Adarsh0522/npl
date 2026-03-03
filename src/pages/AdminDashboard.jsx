import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuction } from '../context/AuctionContext';
import { PlayerUploader } from '../components/admin/PlayerUploader';
import { AuctionController } from '../components/admin/AuctionController';
import { TeamManager } from '../components/admin/TeamManager';
import { PlayerManager } from '../components/admin/PlayerManager';

export default function AdminDashboard() {
    const { auctionState, loading } = useAuction();

    useEffect(() => {
        // Check if settings/auction exists, if not create default
        const initializeAuctionSettings = async () => {
            try {
                const auctionRef = doc(db, 'settings', 'auction');
                const docSnap = await getDoc(auctionRef);

                if (!docSnap.exists()) {
                    await setDoc(auctionRef, {
                        status: 'NOT_STARTED', // NOT_STARTED, LIVE, PAUSED, ENDED
                        currentPlayerId: null,
                        roundNumber: 1,
                        timerStartedAt: null,
                        timerDuration: 30000,
                        basePrice: 1000,
                        increment: 500,
                        currentBid: 0,
                        leadingTeamId: null,
                        resolvedForPlayer: null
                    });
                }
            } catch (error) {
                console.error("Failed to initialize auction settings", error);
            }
        };

        initializeAuctionSettings();
    }, []);

    const [activeTab, setActiveTab] = useState('controls'); // controls, teams, players

    if (loading) {
        return <div className="p-6 text-white text-center">Loading Admin Data...</div>;
    }

    const currentStatus = auctionState?.status?.toUpperCase() || 'UNKNOWN';

    return (
        <div className="min-h-screen bg-brand-darker text-white p-4 sm:p-6 pb-24 lg:pb-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-black text-brand-neon tracking-tight">Organizer Dashboard</h1>
                        <p className="text-gray-400 mt-1">Manage the NPL Auction and teams.</p>
                    </div>
                    <div className="mt-4 sm:mt-0 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg shadow-sm">
                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Status: </span>
                        <span className={`text-sm font-black uppercase ml-2 ${currentStatus === 'LIVE' ? 'text-red-500 animate-pulse' :
                            currentStatus === 'PAUSED' ? 'text-yellow-500' :
                                currentStatus === 'NOT_STARTED' ? 'text-gray-400' : 'text-blue-500'
                            }`}>
                            {currentStatus}
                        </span>
                    </div>
                </header>

                {/* Tabs */}
                <div className="flex space-x-2 border-b border-gray-800 pb-px overflow-x-auto hide-scrollbar">
                    <button onClick={() => setActiveTab('controls')} className={`px-4 py-2 font-bold whitespace-nowrap border-b-2 transition ${activeTab === 'controls' ? 'border-brand-neon text-brand-neon' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                        Live Controls
                    </button>
                    <button onClick={() => setActiveTab('teams')} className={`px-4 py-2 font-bold whitespace-nowrap border-b-2 transition ${activeTab === 'teams' ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                        Franchises
                    </button>
                    <button onClick={() => setActiveTab('players')} className={`px-4 py-2 font-bold whitespace-nowrap border-b-2 transition ${activeTab === 'players' ? 'border-purple-500 text-purple-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                        Player Database
                    </button>
                </div>

                {/* Tab Content */}
                <div className="pt-4">
                    {activeTab === 'controls' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left Column: Auction Controls */}
                            <div className="lg:col-span-2 space-y-6">
                                <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 shadow-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-bl-full blur-3xl pointer-events-none"></div>
                                    <h2 className="text-xl font-bold mb-4 flex items-center"><span className="w-2 h-6 bg-brand-accent mr-3 rounded-full block"></span>Live Controls</h2>
                                    <AuctionController />
                                </div>
                            </div>

                            {/* Right Column: Settings */}
                            <div className="space-y-6">
                                <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 shadow-xl">
                                    <h2 className="text-xl font-bold mb-4 flex items-center"><span className="w-2 h-6 bg-purple-500 mr-3 rounded-full block"></span>Settings</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Base Price (Default)</label>
                                            <input type="number" readOnly value={auctionState?.basePrice || 1000} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Increment</label>
                                            <input type="number" readOnly value={auctionState?.increment || 500} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'teams' && (
                        <TeamManager />
                    )}

                    {activeTab === 'players' && (
                        <div className="space-y-6">
                            <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 shadow-xl">
                                <h2 className="text-xl font-bold mb-4 flex items-center"><span className="w-2 h-6 bg-brand-neon mr-3 rounded-full block"></span>CSV Upload</h2>
                                <PlayerUploader />
                            </div>
                            <PlayerManager />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
