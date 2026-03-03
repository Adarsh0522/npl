import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, query, getDocs, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuction } from '../context/AuctionContext';
import { PlayerUploader } from '../components/admin/PlayerUploader';
import { AuctionController } from '../components/admin/AuctionController';
import { TeamManager } from '../components/admin/TeamManager';
import { PlayerManager } from '../components/admin/PlayerManager';
import { Settings, AlertTriangle, X } from 'lucide-react';

const Modal = ({ title, show, onClose, children }) => show ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-brand-dark border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                <h3 className="font-bold text-white uppercase tracking-widest text-sm">{title}</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20} /></button>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    </div>
) : null;

export default function AdminDashboard() {
    const { auctionState, loading } = useAuction();
    const [showDemoReset, setShowDemoReset] = useState(false);
    const [showFullReset, setShowFullReset] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState('');

    useEffect(() => {
        const initializeAuctionSettings = async () => {
            try {
                const auctionRef = doc(db, 'settings', 'auction');
                const docSnap = await getDoc(auctionRef);

                if (!docSnap.exists()) {
                    await setDoc(auctionRef, {
                        status: 'NOT_STARTED',
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

    const [activeTab, setActiveTab] = useState('controls');

    const auctionRef = doc(db, 'settings', 'auction');

    const handleDemoReset = async () => {
        setResetLoading(true); setResetError('');
        try {
            const batch = writeBatch(db);
            const snapshot = await getDocs(query(collection(db, 'players'), orderBy('createdAt', 'asc')));

            if (snapshot.empty) throw new Error("No players found");

            const firstPlayer = snapshot.docs[0];

            snapshot.docs.forEach((d) => {
                batch.update(d.ref, {
                    status: d.id === firstPlayer.id ? 'LIVE' : 'READY',
                    teamId: null,
                    soldPrice: 0
                });
            });

            const teamsSnap = await getDocs(collection(db, 'teams'));
            teamsSnap.docs.forEach(d => {
                batch.update(d.ref, { totalSpent: 0, squadCount: 0 });
            });

            batch.update(auctionRef, {
                status: 'LIVE',
                currentPlayerId: firstPlayer.id,
                currentBid: firstPlayer.data().basePrice || 0,
                leadingTeamId: null,
                resolvedForPlayer: null,
                timerStartedAt: serverTimestamp(),
                timerDuration: 30000,
                nextPlayerScheduledAt: null,
                lastResolvedPlayerId: null,
                lastResolvedStatus: null,
                lastResolvedAt: null
            });

            await batch.commit();
            setShowDemoReset(false);
        } catch (err) { setResetError(err.message); }
        finally { setResetLoading(false); }
    };

    const handleFullReset = async () => {
        setResetLoading(true); setResetError('');
        try {
            const batch = writeBatch(db);
            const snapshot = await getDocs(collection(db, 'players'));
            snapshot.docs.forEach(d => {
                batch.update(d.ref, {
                    status: 'READY',
                    teamId: null,
                    soldPrice: 0
                });
            });

            const teamsSnap = await getDocs(collection(db, 'teams'));
            teamsSnap.docs.forEach(d => {
                batch.update(d.ref, { totalSpent: 0, squadCount: 0 });
            });

            batch.update(auctionRef, {
                status: 'NOT_STARTED',
                currentPlayerId: null,
                lastPlayerId: null,
                currentBid: 0,
                leadingTeamId: null,
                resolvedForPlayer: null,
                roundNumber: 1,
                nextPlayerScheduledAt: null,
                lastResolvedPlayerId: null,
                lastResolvedStatus: null,
                lastResolvedAt: null
            });
            await batch.commit();
            setShowFullReset(false);
        } catch (err) { setResetError(err.message); }
        finally { setResetLoading(false); }
    };

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
                                currentStatus === 'ANNOUNCING' ? 'text-orange-400 animate-pulse' :
                                    currentStatus === 'NOT_STARTED' ? 'text-gray-500' : ''
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
                        <div className="space-y-6">
                            {/* Live Controls — Full Width */}
                            <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-bl-full blur-3xl pointer-events-none"></div>
                                <h2 className="text-xl font-bold mb-4 flex items-center"><span className="w-2 h-6 bg-brand-accent mr-3 rounded-full block"></span>Live Controls</h2>
                                <AuctionController />
                            </div>

                            {/* Settings — Full Width, Below */}
                            <div className="bg-brand-dark rounded-xl border border-gray-800 p-6 shadow-xl">
                                <h2 className="text-xl font-bold mb-4 flex items-center"><span className="w-2 h-6 bg-purple-500 mr-3 rounded-full block"></span>Settings</h2>
                                <div className="space-y-6">

                                    {resetError && (
                                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm font-medium">
                                            {resetError}
                                        </div>
                                    )}

                                    {/* Base Price & Increment */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Base Price (Default)</label>
                                            <input type="number" readOnly value={auctionState?.basePrice || 1000} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Increment</label>
                                            <input type="number" readOnly value={auctionState?.increment || 500} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                    </div>

                                    {/* Auto Advance Toggle */}
                                    <div className="p-4 border border-gray-700 bg-gray-900/40 rounded-xl">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Settings size={16} className="text-gray-400" />
                                                <div>
                                                    <p className="text-sm font-bold text-white">Auto Advance</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">Automatically advance to next player after sold/unsold announcement</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await updateDoc(auctionRef, {
                                                            autoAdvance: auctionState?.autoAdvance === false ? true : false
                                                        });
                                                    } catch (err) { console.error(err); }
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${auctionState?.autoAdvance !== false ? 'bg-brand-neon' : 'bg-gray-700'
                                                    }`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${auctionState?.autoAdvance !== false ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="p-4 border border-red-900/50 bg-red-900/10 rounded-xl">
                                        <div className="flex items-center gap-2 mb-3">
                                            <AlertTriangle size={14} className="text-red-500" />
                                            <p className="text-red-500 font-bold uppercase tracking-widest text-[10px]">Danger Zone</p>
                                        </div>
                                        <p className="text-gray-400 text-xs mb-4">These actions reset auction progress and states. Proceed with caution.</p>
                                        <div className="flex gap-3">
                                            <button onClick={() => setShowDemoReset(true)} className="flex-1 sm:flex-none px-4 py-2.5 bg-red-800/10 text-red-500 hover:bg-red-800/20 hover:text-white font-bold uppercase text-[10px] tracking-wider rounded border border-red-900/50 transition disabled:opacity-50">Demo Reset</button>
                                            <button onClick={() => setShowFullReset(true)} className="flex-1 sm:flex-none px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[10px] tracking-wider rounded transition shadow-lg shadow-red-900/50 disabled:opacity-50">Full Reset</button>
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

            {/* Reset Modals */}
            <Modal title="Confirm Demo Reset" show={showDemoReset} onClose={() => setShowDemoReset(false)}>
                <p className="text-gray-300 font-medium mb-6 text-sm">This will reset all player statuses to <span className="font-bold text-white uppercase">UNSOLD</span> and clear sold prices, but keeps the auction alive and running. Teams and Base prices are not deleted. Continue?</p>
                <div className="flex gap-4">
                    <button onClick={() => setShowDemoReset(false)} className="flex-1 py-3 bg-gray-800 text-white rounded font-bold uppercase tracking-widest text-xs hover:bg-gray-700 transition">Cancel</button>
                    <button onClick={handleDemoReset} disabled={resetLoading} className="flex-1 py-3 bg-red-600 text-white rounded font-black uppercase tracking-widest text-xs transition hover:bg-red-500 shadow-lg shadow-red-900/30">Reset Players</button>
                </div>
            </Modal>

            <Modal title="Confirm Full Reset" show={showFullReset} onClose={() => setShowFullReset(false)}>
                <p className="text-gray-300 font-medium mb-6 text-sm">This will clear ALL auction results, set all players to <span className="font-bold text-white uppercase">UNSOLD</span>, and transition system to <span className="font-bold text-white uppercase">NOT_STARTED</span>. Continue?</p>
                <div className="flex gap-4">
                    <button onClick={() => setShowFullReset(false)} className="flex-1 py-3 bg-gray-800 text-white rounded font-bold uppercase tracking-widest text-xs hover:bg-gray-700 transition">Cancel</button>
                    <button onClick={handleFullReset} disabled={resetLoading} className="flex-1 py-3 bg-red-600 text-white rounded font-black uppercase tracking-widest text-xs transition hover:bg-red-500 shadow-lg shadow-red-900/30">Confirm Reset</button>
                </div>
            </Modal>
        </div>
    );
}
