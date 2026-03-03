import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit, orderBy, onSnapshot, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuction } from '../../context/AuctionContext';
import { useAuctionTimer } from '../../hooks/useAuctionTimer';
import { useAuctionResolver } from '../../hooks/useAuctionResolver';
import {
    Play, Pause, Square, FastForward, RotateCcw,
    XCircle, Tag, RefreshCw, AlertTriangle, Edit3, User, X, Clock
} from 'lucide-react';

const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

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

export const AuctionController = () => {
    const { auctionState } = useAuction();
    const { timeLeft } = useAuctionTimer();
    useAuctionResolver(); // Auto-resolve when timer expires
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Data states
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [teams, setTeams] = useState([]);
    const [allPlayers, setAllPlayers] = useState([]);

    // Modals
    const [showOverride, setShowOverride] = useState(false);
    const [showAssign, setShowAssign] = useState(false);

    // Form states
    const [overridePrice, setOverridePrice] = useState('');
    const [overrideTeam, setOverrideTeam] = useState('');

    const [assignPrice, setAssignPrice] = useState('');
    const [assignTeam, setAssignTeam] = useState('');

    const auctionRef = doc(db, 'settings', 'auction');

    useEffect(() => {
        const tUnsub = onSnapshot(collection(db, 'teams'), (snap) => {
            setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        const pUnsub = onSnapshot(collection(db, 'players'), (snap) => {
            setAllPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { tUnsub(); pUnsub(); };
    }, []);

    useEffect(() => {
        if (auctionState?.currentPlayerId) {
            const unsub = onSnapshot(doc(db, 'players', auctionState.currentPlayerId), (docSnap) => {
                if (docSnap.exists()) setCurrentPlayer({ id: docSnap.id, ...docSnap.data() });
                else setCurrentPlayer(null);
            });
            return () => unsub();
        } else {
            setCurrentPlayer(null);
        }
    }, [auctionState?.currentPlayerId]);

    const status = auctionState?.status?.toUpperCase() || 'NOT_STARTED';
    const isNotStarted = status === 'NOT_STARTED' || status === 'IDLE';
    const isLive = status === 'LIVE';
    const isPaused = status === 'PAUSED';
    const isEnded = status === 'ENDED';
    const isResolvedWaiting = status === 'ANNOUNCING';

    const getRemainingPurse = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return 0;
        const spent = allPlayers.filter(p => p.teamId === teamId).reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
        return (team.totalBudget || 0) - spent;
    };

    const handleError = (msg) => {
        setError(msg);
        setTimeout(() => setError(''), 5000);
    };

    const updateStatus = async (newStatus) => {
        setLoading(true); setError('');
        try {
            if (newStatus === 'LIVE' && isNotStarted) {
                const qFirst = query(collection(db, 'players'), orderBy('createdAt', 'asc'), limit(1));
                const firstSnap = await getDocs(qFirst);

                if (firstSnap.empty) throw new Error("No players in database.");

                const firstPlayer = firstSnap.docs[0];
                const batch = writeBatch(db);

                const allSnap = await getDocs(collection(db, 'players'));
                allSnap.forEach(docSnap => {
                    if (docSnap.id === firstPlayer.id) {
                        batch.update(docSnap.ref, { status: 'LIVE' });
                    } else {
                        batch.update(docSnap.ref, { status: 'READY' });
                    }
                });

                batch.update(auctionRef, {
                    status: 'LIVE',
                    currentPlayerId: firstPlayer.id,
                    currentBid: firstPlayer.data().basePrice || 0,
                    leadingTeamId: null,
                    resolvedForPlayer: null,
                    timerStartedAt: serverTimestamp(),
                    timerDuration: 30000
                });

                await batch.commit();
                return;
            } else if (newStatus === 'PAUSED' && isLive) {
                // Pause logic
                await runTransaction(db, async (transaction) => {
                    const freshAuction = await transaction.get(auctionRef);
                    if (!freshAuction.exists()) return;
                    const freshData = freshAuction.data();

                    if (freshData.status !== 'LIVE') return; // Strict guard

                    transaction.update(auctionRef, { status: 'PAUSED' });
                });
                return;
            } else if (newStatus === 'LIVE' && isPaused) {
                // Resume logic
                await runTransaction(db, async (transaction) => {
                    const freshAuction = await transaction.get(auctionRef);
                    if (!freshAuction.exists()) return;
                    const freshData = freshAuction.data();

                    // strict resume safeguards
                    if (freshData.status === 'ANNOUNCING') { return; }
                    if (freshData.status !== 'PAUSED') return;
                    if (!freshData.currentPlayerId) return;

                    transaction.update(auctionRef, {
                        status: 'LIVE',
                        timerStartedAt: serverTimestamp() // Restart timer
                    });
                });
                return;
            }
            await updateDoc(auctionRef, { status: newStatus });
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    const nextPlayer = async (toggleLoading = true) => {
        if (toggleLoading) setLoading(true);
        setError('');
        let success = false;
        try {
            // Find next eligible player
            const qUp = query(collection(db, 'players'), where('status', 'in', ['READY', 'UNSOLD']));
            const upSnap = await getDocs(qUp);

            if (!upSnap.empty) {
                const players = upSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const randomIndex = Math.floor(Math.random() * players.length);
                const selectedPlayer = players[randomIndex];

                await runTransaction(db, async (transaction) => {
                    // --- ALL READS FIRST ---
                    const freshAuctionSnap = await transaction.get(auctionRef);
                    if (!freshAuctionSnap.exists()) return;
                    const freshData = freshAuctionSnap.data();

                    // Guard: allow advance from LIVE (manual skip), ANNOUNCING, or PAUSED
                    if (freshData.status !== 'LIVE' && freshData.status !== 'ANNOUNCING' && freshData.status !== 'PAUSED') return;

                    // If in ANNOUNCING, verify we haven't already advanced
                    if (freshData.status === 'ANNOUNCING'
                        && freshData.currentPlayerId !== freshData.lastResolvedPlayerId) return;

                    const playerRef = doc(db, 'players', selectedPlayer.id);
                    const freshPlayerSnap = await transaction.get(playerRef);
                    const freshPlayer = freshPlayerSnap.exists() ? freshPlayerSnap.data() : selectedPlayer;

                    let currentPlayerSnap = null;
                    let currentPlayerRef = null;
                    // If current player is still LIVE (manual skip), read to mark UNSOLD
                    if (freshData.currentPlayerId && freshData.status === 'LIVE') {
                        currentPlayerRef = doc(db, 'players', freshData.currentPlayerId);
                        currentPlayerSnap = await transaction.get(currentPlayerRef);
                    }

                    // --- READS COMPLETE, COMMENCE WRITES ---
                    if (freshPlayer.status === 'SOLD') return; // Strict guard against sold re-entry

                    if (currentPlayerSnap && currentPlayerSnap.exists()) {
                        const data = currentPlayerSnap.data();
                        if (data.status === 'LIVE' && !data.teamId) {
                            transaction.update(currentPlayerRef, { status: 'UNSOLD' });
                        }
                    }

                    transaction.update(playerRef, { status: 'LIVE' });
                    transaction.update(auctionRef, {
                        currentPlayerId: selectedPlayer.id,
                        currentBid: freshPlayer.basePrice || 0,
                        leadingTeamId: null,
                        timerStartedAt: serverTimestamp(),
                        status: 'LIVE',
                        // Clear announcement fields
                        nextPlayerScheduledAt: null,
                        lastResolvedPlayerId: null,
                        lastResolvedStatus: null
                    });
                });
                success = true;
            } else {
                await runTransaction(db, async (transaction) => {
                    const freshAuction = await transaction.get(auctionRef);
                    if (!freshAuction.exists()) return;
                    const freshData = freshAuction.data();

                    if (freshData.status !== 'LIVE' && freshData.status !== 'ANNOUNCING' && freshData.status !== 'PAUSED') return;

                    transaction.update(auctionRef, {
                        status: 'ENDED',
                        currentPlayerId: null,
                        timerStartedAt: null,
                        leadingTeamId: null,
                        currentBid: 0,
                        nextPlayerScheduledAt: null,
                        lastResolvedPlayerId: null,
                        lastResolvedStatus: null
                    });
                });
                success = true;
            }
        } catch (err) { handleError(err.message); }
        finally { if (toggleLoading) setLoading(false); }
        return success;
    };

    const handleReopenLast = async () => {
        if (!auctionState?.lastPlayerId) return handleError("No last player tracked.");
        setLoading(true); setError('');
        try {
            const batch = writeBatch(db);
            if (auctionState.currentPlayerId) {
                batch.update(doc(db, 'players', auctionState.currentPlayerId), { status: 'READY' });
            }
            batch.update(doc(db, 'players', auctionState.lastPlayerId), { status: 'LIVE', teamId: null, soldPrice: 0 });

            batch.update(auctionRef, {
                currentPlayerId: auctionState.lastPlayerId,
                lastPlayerId: null,
                currentBid: 0,
                leadingTeamId: null,
                resolvedForPlayer: null,
                status: 'PAUSED',
                nextPlayerScheduledAt: null,
                lastResolvedPlayerId: null,
                lastResolvedStatus: null,
                lastResolvedAt: null
            });
            await batch.commit();
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    const handleForceUnsold = async () => {
        if (!auctionState?.currentPlayerId) return;
        setLoading(true); setError('');
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'players', auctionState.currentPlayerId), {
                status: 'UNSOLD',
                teamId: null,
                soldPrice: 0
            });

            const qUp = query(collection(db, 'players'), where('status', 'in', ['READY', 'UNSOLD']));
            const upSnap = await getDocs(qUp);

            if (!upSnap.empty) {
                const players = upSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const randomIndex = Math.floor(Math.random() * players.length);
                const selectedPlayer = players[randomIndex];

                batch.update(doc(db, 'players', selectedPlayer.id), { status: 'LIVE' });
                batch.update(auctionRef, {
                    currentPlayerId: selectedPlayer.id,
                    currentBid: selectedPlayer.basePrice || 0,
                    leadingTeamId: null,
                    resolvedForPlayer: null,
                    timerStartedAt: serverTimestamp(),
                    timerDuration: 30000,
                    status: 'LIVE',
                    nextPlayerScheduledAt: null,
                    lastResolvedPlayerId: null,
                    lastResolvedStatus: null,
                    lastResolvedAt: null
                });
            } else {
                batch.update(auctionRef, {
                    status: 'ENDED',
                    currentPlayerId: null,
                    leadingTeamId: null,
                    currentBid: 0,
                    nextPlayerScheduledAt: null,
                    lastResolvedPlayerId: null,
                    lastResolvedStatus: null,
                    lastResolvedAt: null
                });
            }
            await batch.commit();
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    const handleResetCurrent = async () => {
        if (!auctionState?.currentPlayerId) return;
        setLoading(true); setError('');
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'players', auctionState.currentPlayerId), {
                teamId: null,
                soldPrice: 0,
                status: 'LIVE'
            });
            batch.update(auctionRef, {
                currentBid: currentPlayer?.basePrice || 0,
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
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    const handleForceAssign = async () => {
        if (!assignTeam) return handleError("Select a team");
        if (!assignPrice || isNaN(assignPrice) || Number(assignPrice) <= 0) return handleError("Enter a valid price > 0");

        const remaining = getRemainingPurse(assignTeam);
        if (Number(assignPrice) > remaining) return handleError(`Team only has ₹${remaining.toLocaleString()} left`);

        setLoading(true); setError('');
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'players', auctionState.currentPlayerId), {
                teamId: assignTeam,
                soldPrice: Number(assignPrice),
                status: 'SOLD'
            });

            // Update team totalSpent and squadCount
            const team = teams.find(t => t.id === assignTeam);
            if (team) {
                batch.update(doc(db, 'teams', assignTeam), {
                    totalSpent: (team.totalSpent || 0) + Number(assignPrice),
                    squadCount: (team.squadCount || 0) + 1
                });
            }

            const qUp = query(collection(db, 'players'), where('status', 'in', ['READY', 'UNSOLD']));
            const upSnap = await getDocs(qUp);

            if (!upSnap.empty) {
                const players = upSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const randomIndex = Math.floor(Math.random() * players.length);
                const selectedPlayer = players[randomIndex];

                batch.update(doc(db, 'players', selectedPlayer.id), { status: 'LIVE' });
                batch.update(auctionRef, {
                    currentPlayerId: selectedPlayer.id,
                    currentBid: selectedPlayer.basePrice || 0,
                    leadingTeamId: null,
                    resolvedForPlayer: null,
                    timerStartedAt: serverTimestamp(),
                    timerDuration: 30000,
                    status: 'LIVE',
                    nextPlayerScheduledAt: null,
                    lastResolvedPlayerId: null,
                    lastResolvedStatus: null,
                    lastResolvedAt: null
                });
            } else {
                batch.update(auctionRef, {
                    status: 'ENDED',
                    currentPlayerId: null,
                    leadingTeamId: null,
                    currentBid: 0,
                    nextPlayerScheduledAt: null,
                    lastResolvedPlayerId: null,
                    lastResolvedStatus: null,
                    lastResolvedAt: null
                });
            }

            await batch.commit();
            setShowAssign(false);
            setAssignPrice('');
            setAssignTeam('');
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    const handleOverrideBid = async () => {
        if (!overridePrice || isNaN(overridePrice) || Number(overridePrice) < 0) return handleError("Valid price required");

        if (overrideTeam) {
            const remaining = getRemainingPurse(overrideTeam);
            if (Number(overridePrice) > remaining) return handleError(`Team only has ₹${remaining.toLocaleString()} left`);
        }

        setLoading(true); setError('');
        try {
            await updateDoc(auctionRef, {
                currentBid: Number(overridePrice),
                leadingTeamId: overrideTeam || null
            });
            setShowOverride(false);
            setOverridePrice('');
            setOverrideTeam('');
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    const handleDemoReset = async () => {
        setLoading(true); setError('');
        try {
            const batch = writeBatch(db);
            const snapshot = await getDocs(query(collection(db, 'players'), orderBy('createdAt', 'asc')));

            if (snapshot.empty) throw new Error("No players found");

            const firstPlayer = snapshot.docs[0];

            snapshot.docs.forEach((d) => {
                batch.update(d.ref, {
                    status: d.id === firstPlayer.id ? 'LIVE' : 'UPCOMING',
                    teamId: null,
                    soldPrice: 0
                });
            });

            // Reset team stats
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
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    const handleFullReset = async () => {
        setLoading(true); setError('');
        try {
            const batch = writeBatch(db);
            const snapshot = await getDocs(collection(db, 'players'));
            snapshot.docs.forEach(d => {
                batch.update(d.ref, {
                    status: 'UPCOMING',
                    teamId: null,
                    soldPrice: 0
                });
            });

            // Reset team stats
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
        } catch (err) { handleError(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 relative z-10 text-sm">

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start text-red-400">
                    <AlertTriangle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Auction Info Panel */}
            <div className="bg-gray-900/60 p-5 rounded-xl border border-gray-800 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div className="flex-1 w-full">
                    <p className="text-gray-500 uppercase font-bold text-[10px] tracking-widest mb-2">Current Player</p>
                    <div className="flex items-center gap-3">
                        {currentPlayer ? (
                            <>
                                {currentPlayer.photoUrl ? (
                                    <img src={currentPlayer.photoUrl} className="w-12 h-12 rounded-full object-cover border-2 border-gray-700 bg-black" alt="player" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700"><User className="text-gray-500" size={24} /></div>
                                )}
                                <div className="min-w-0">
                                    <p className="font-black text-white text-lg leading-tight uppercase tracking-wide text-wrap-fix clamp-2">{currentPlayer.name}</p>
                                    <p className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mt-0.5 truncate">{currentPlayer.playingRole || 'Player'} • Base: ₹{(Number(currentPlayer.basePrice) || 0).toLocaleString()}</p>
                                </div>
                            </>
                        ) : (
                            <div className="py-2 border border-dashed border-gray-700 w-full text-center rounded bg-brand-dark overflow-hidden flex items-center justify-center min-h-[48px]">
                                <p className="text-gray-500 font-bold tracking-widest uppercase text-xs">No Active Player</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Timer Display */}
                <div className="flex-[0.6] w-full md:border-l border-gray-800 md:pl-6 flex flex-col justify-center items-center">
                    <p className="text-gray-500 uppercase font-bold text-[10px] tracking-widest mb-2">Timer</p>
                    {isLive && timeLeft !== null ? (
                        <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${timeLeft <= 10
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-gray-900 border-gray-700'
                            }`}>
                            <Clock size={20} className={timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-brand-neon'} />
                            <span className={`text-3xl font-black tracking-tighter tabular-nums ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
                                {formatTime(timeLeft)}
                            </span>
                        </div>
                    ) : (
                        <span className="text-gray-600 font-bold text-sm uppercase tracking-widest">--:--</span>
                    )}
                </div>

                <div className="flex-1 w-full md:border-l border-gray-800 md:pl-6">
                    <p className="text-gray-500 uppercase font-bold text-[10px] tracking-widest mb-2">Current Bid Status</p>
                    <div className="flex flex-col">
                        <p className="font-black text-brand-neon text-3xl md:text-2xl leading-none mb-1 shadow-sm">₹{(auctionState?.currentBid || 0).toLocaleString()}</p>
                        <p className="text-gray-300 font-bold text-[10px] uppercase tracking-widest truncate">
                            {auctionState?.leadingTeamId
                                ? `Leading: ${teams.find(t => t.id === auctionState.leadingTeamId)?.name || 'Unknown'}`
                                : 'No Bid Yet'}
                        </p>
                    </div>
                </div>

                <div className="flex-[0.8] w-full md:border-l border-gray-800 md:pl-6 flex flex-col justify-center">
                    <p className="text-gray-500 uppercase font-bold text-[10px] tracking-widest mb-2">Auction Totals</p>
                    <div className="flex flex-col gap-1.5 text-xs font-black uppercase tracking-widest">
                        <div className="flex justify-between items-center bg-gray-900 px-3 py-1.5 rounded border border-gray-800">
                            <span className="text-gray-400">SOLD</span>
                            <span className="text-green-500 text-sm">{allPlayers.filter(p => p.status === 'SOLD').length}</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-900 px-3 py-1.5 rounded border border-gray-800">
                            <span className="text-gray-400">UNSOLD</span>
                            <span className="text-red-500 text-sm">{allPlayers.filter(p => p.status === 'UNSOLD').length}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                    onClick={() => updateStatus('LIVE')}
                    disabled={loading || isLive || isResolvedWaiting}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${!isLive && !isResolvedWaiting && !loading ? 'bg-brand-neon/10 border-brand-neon/30 text-brand-neon hover:bg-brand-neon hover:text-black shadow-lg shadow-brand-neon/5' : 'bg-gray-900 border-gray-800 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                >
                    <Play size={24} className="mb-1" />
                    <span className="font-bold uppercase tracking-wider text-[10px]">{isPaused ? 'Resume' : 'Start'} Auction</span>
                </button>

                <button
                    onClick={() => updateStatus('PAUSED')}
                    disabled={loading || (!isLive && !isResolvedWaiting)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${isLive && !loading ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500 hover:text-black shadow-lg shadow-yellow-500/5' : 'bg-gray-900 border-gray-800 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                >
                    <Pause size={24} className="mb-1" />
                    <span className="font-bold uppercase tracking-wider text-[10px]">Pause Auction</span>
                </button>

                <button
                    onClick={() => updateStatus('ENDED')}
                    disabled={loading || (!isLive && !isPaused)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${(isLive || isPaused) && !loading ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white shadow-lg shadow-red-500/5' : 'bg-gray-900 border-gray-800 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                >
                    <Square size={24} className="mb-1" />
                    <span className="font-bold uppercase tracking-wider text-[10px]">End Auction</span>
                </button>

                <button
                    onClick={() => nextPlayer(true)}
                    disabled={loading || (!isLive && !isResolvedWaiting)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${(isLive || isResolvedWaiting) && !loading ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500 hover:text-white shadow-lg shadow-blue-500/5' : 'bg-gray-900 border-gray-800 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                >
                    <FastForward size={24} className="mb-1" />
                    <span className="font-bold uppercase tracking-wider text-[10px]">Next Player</span>
                </button>
            </div>

            <div className="h-px bg-gray-800 w-full" />

            {/* Player flow controls & Modifiers */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <button
                    onClick={handleReopenLast}
                    disabled={loading || !auctionState?.lastPlayerId || isNotStarted}
                    className="flex flex-col items-center justify-center p-3 bg-brand-darker border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <RotateCcw size={18} className="mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Reopen<br />Last</span>
                </button>

                <button
                    onClick={handleForceUnsold}
                    disabled={loading || !auctionState?.currentPlayerId}
                    className="flex flex-col items-center justify-center p-3 bg-brand-darker border border-gray-700 text-gray-300 rounded-lg hover:bg-red-900/40 hover:text-red-400 hover:border-red-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <XCircle size={18} className="mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Force<br />Unsold</span>
                </button>

                <button
                    onClick={() => setShowAssign(true)}
                    disabled={loading || !auctionState?.currentPlayerId}
                    className="flex flex-col items-center justify-center p-3 bg-brand-darker border border-gray-700 text-gray-300 rounded-lg hover:bg-brand-neon/20 hover:text-brand-neon hover:border-brand-neon/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Tag size={18} className="mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Force<br />Assign</span>
                </button>

                <button
                    onClick={handleResetCurrent}
                    disabled={loading || !auctionState?.currentPlayerId}
                    className="flex flex-col items-center justify-center p-3 bg-brand-darker border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={18} className="mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Reset<br />Current</span>
                </button>

                <button
                    onClick={() => {
                        setOverridePrice(auctionState?.currentBid || 0);
                        setOverrideTeam(auctionState?.leadingTeamId || '');
                        setShowOverride(true);
                    }}
                    disabled={loading || !auctionState?.currentPlayerId}
                    className="col-span-2 md:col-span-1 flex flex-col items-center justify-center p-3 bg-brand-darker border border-gray-700 text-gray-300 rounded-lg hover:bg-purple-500/20 hover:text-purple-400 hover:border-purple-500/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Edit3 size={18} className="mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-center leading-tight">Edit<br />Bid</span>
                </button>
            </div>





            <Modal title="Force Assign Player" show={showAssign} onClose={() => setShowAssign(false)}>
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Select Team</label>
                        <select value={assignTeam} onChange={(e) => setAssignTeam(e.target.value)} className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white focus:border-brand-neon focus:outline-none focus:ring-1 focus:ring-brand-neon transition">
                            <option value="" className="text-gray-500">-- Choose Team --</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name} (Purse: ₹{getRemainingPurse(t.id).toLocaleString()})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Final Price (₹)</label>
                        <input type="number" min="0" value={assignPrice} onChange={(e) => setAssignPrice(e.target.value)} className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white focus:border-brand-neon focus:outline-none focus:ring-1 focus:ring-brand-neon transition font-medium" placeholder="Enter amount..." />
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setShowAssign(false)} className="flex-1 py-3 bg-gray-800 text-white rounded font-bold uppercase tracking-widest text-xs hover:bg-gray-700 transition">Cancel</button>
                    <button onClick={handleForceAssign} disabled={loading} className="flex-1 py-3 bg-brand-neon text-black rounded font-black uppercase tracking-widest text-xs hover:bg-white transition shadow-[0_0_15px_rgba(57,255,20,0.3)]">Assign</button>
                </div>
            </Modal>

            <Modal title="Edit Current Bid" show={showOverride} onClose={() => setShowOverride(false)}>
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">New Bid Amount (₹)</label>
                        <input type="number" min="0" value={overridePrice} onChange={(e) => setOverridePrice(e.target.value)} className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition font-medium" placeholder="Amount..." />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Leading Team (Optional)</label>
                        <select value={overrideTeam} onChange={(e) => setOverrideTeam(e.target.value)} className="w-full p-3 bg-gray-900 border border-gray-700 rounded text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition">
                            <option value="">-- No Team (Reset Lead) --</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name} (Purse: ₹{getRemainingPurse(t.id).toLocaleString()})</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setShowOverride(false)} className="flex-1 py-3 bg-gray-800 text-white rounded font-bold uppercase tracking-widest text-xs hover:bg-gray-700 transition">Cancel</button>
                    <button onClick={handleOverrideBid} disabled={loading} className="flex-1 py-3 bg-purple-600 text-white rounded font-black uppercase tracking-widest text-xs hover:bg-purple-500 transition shadow-[0_0_15px_rgba(168,85,247,0.3)]">Update Bid</button>
                </div>
            </Modal>
        </div>
    );
};
