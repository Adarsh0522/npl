import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, runTransaction, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Edit2, ShieldAlert, Gavel, UserSquare, X, Filter } from 'lucide-react';

export const PlayerManager = () => {
    const [players, setPlayers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterStatus, setFilterStatus] = useState('all'); // all, sold, unsold
    const [filterRole, setFilterRole] = useState('all');
    const [filterTeam, setFilterTeam] = useState('all');

    // Edit Modal States
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [formData, setFormData] = useState({});
    const [errorMsg, setErrorMsg] = useState('');

    // Force Assign States
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState('');
    const [auctionPrice, setAuctionPrice] = useState('');
    const [assignError, setAssignError] = useState('');

    useEffect(() => {
        const unsubPlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
            setPlayers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
            setTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubPlayers(); unsubTeams(); };
    }, []);

    const filteredPlayers = players.filter(p => {
        const isSold = p.status === 'SOLD' || p.teamId;
        if (filterStatus === 'sold' && !isSold) return false;
        if (filterStatus === 'unsold' && isSold) return false;
        if (filterRole !== 'all' && p.playingRole !== filterRole) return false;
        if (filterTeam !== 'all' && p.teamId !== filterTeam) return false;
        return true;
    });

    const openEdit = (player) => {
        setCurrentPlayer(player);
        setFormData({
            name: player.name || '',
            dob: player.dob || '',
            photoUrl: player.photoUrl || '',
            role: player.playingRole || 'Batsman',
            battingStyle: player.battingStyle || 'Right Hand',
            bowlingStyle: player.bowlingStyle || 'None',
            mobile: player.mobile || '',
            basePrice: player.basePrice || 1000,
            isActive: player.isActive !== false
        });
        setErrorMsg('');
        setIsEditOpen(true);
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'basePrice' ? Number(value) : value }));
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        const duplicateMobile = players.some(p => p.mobile === formData.mobile && p.id !== currentPlayer.id);
        if (duplicateMobile) {
            setErrorMsg('A player with this mobile number already exists');
            return;
        }

        try {
            const calculateAge = (dobString) => {
                if (!dobString) return currentPlayer.age || 0;
                const today = new Date();
                const birthDate = new Date(dobString);
                let age = today.getFullYear() - birthDate.getFullYear();
                const m = today.getMonth() - birthDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                return isNaN(age) ? 0 : age;
            };

            const updatedAge = formData.dob ? calculateAge(formData.dob) : (currentPlayer.age || 0);

            const playerRef = doc(db, 'players', currentPlayer.id);
            await updateDoc(playerRef, {
                name: formData.name,
                dob: formData.dob || '',
                age: updatedAge,
                photoUrl: formData.photoUrl,
                playingRole: formData.role,
                battingStyle: formData.battingStyle,
                bowlingStyle: formData.bowlingStyle,
                mobile: formData.mobile,
                basePrice: formData.basePrice,
                isActive: formData.isActive === 'true' || formData.isActive === true
            });
            setIsEditOpen(false);
            setCurrentPlayer(null);
        } catch (err) {
            setErrorMsg(err.message);
        }
    };

    const openForceAssign = (player) => {
        setCurrentPlayer(player);
        setAssignTarget(player.teamId || '');
        setAuctionPrice(player.soldPrice || player.basePrice || '');
        setAssignError('');
        setIsAssignOpen(true);
    };

    // Calculate dynamically
    const getTeamRemainingPurse = (teamId, excludePlayerId = null) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return 0;
        const totalSpent = players
            .filter(p => p.teamId === teamId && p.id !== excludePlayerId)
            .reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
        return (team.totalBudget || 0) - totalSpent;
    };

    const handleForceAssign = async (e) => {
        e.preventDefault();
        setAssignError('');

        if (!auctionPrice || Number(auctionPrice) <= 0) {
            setAssignError('Valid auction price required.');
            return;
        }

        if (!assignTarget) {
            setAssignError('Team is required.');
            return;
        }

        const numericPrice = Number(auctionPrice);
        if (numericPrice < (currentPlayer.basePrice || 0)) {
            setAssignError('Auction price cannot be less than base price.');
            return;
        }

        if (currentPlayer.status === 'SOLD' || currentPlayer.teamId) {
            const confirmed = window.confirm("Reassign player and update sold price?");
            if (!confirmed) return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const teamRef = doc(db, 'teams', assignTarget);
                const playerRef = doc(db, 'players', currentPlayer.id);

                const teamSnap = await transaction.get(teamRef);
                if (!teamSnap.exists()) throw new Error("Team not found");

                const remainingPurse = getTeamRemainingPurse(assignTarget, currentPlayer.id);

                if (numericPrice > remainingPurse) {
                    throw new Error("Insufficient Budget");
                }

                // Update Player
                transaction.update(playerRef, {
                    teamId: assignTarget,
                    soldPrice: numericPrice,
                    status: 'SOLD'
                });
            });

            setIsAssignOpen(false);
            setCurrentPlayer(null);
        } catch (err) {
            setAssignError(err.message);
        }
    };

    const getTeamName = (id) => {
        const t = teams.find(t => t.id === id);
        return t ? t.name : 'Unknown Team';
    };

    return (
        <div className="space-y-6">
            <div className="bg-brand-dark p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl">
                <div className="flex items-center space-x-2 text-xl font-bold">
                    <span className="w-2 h-6 bg-purple-500 rounded-full block"></span>
                    <h2>Player Database Output</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center space-x-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1 focus-within:border-brand-neon">
                        <Filter size={16} className="text-gray-400" />
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-transparent text-sm text-gray-300 outline-none cursor-pointer">
                            <option className="bg-brand-dark text-white" value="all">All Status</option>
                            <option className="bg-brand-dark text-white" value="sold">Sold</option>
                            <option className="bg-brand-dark text-white" value="unsold">Unsold</option>
                        </select>
                    </div>
                    <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="bg-gray-900 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1 outline-none cursor-pointer focus:border-brand-neon">
                        <option className="bg-brand-dark text-white" value="all">All Roles</option>
                        <option className="bg-brand-dark text-white" value="Batsman">Batsman</option>
                        <option className="bg-brand-dark text-white" value="Bowler">Bowler</option>
                        <option className="bg-brand-dark text-white" value="Allrounder">Allrounder</option>
                        <option className="bg-brand-dark text-white" value="Wicketkeeper">Wicketkeeper</option>
                    </select>
                    <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="bg-gray-900 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1 outline-none cursor-pointer focus:border-brand-neon">
                        <option className="bg-brand-dark text-white" value="all">All Teams</option>
                        {teams.map(t => <option className="bg-brand-dark text-white" key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>

            {loading ? <div className="text-center p-8 text-gray-400">Loading players...</div> : (
                <div className="bg-brand-dark rounded-xl border border-gray-800 overflow-x-auto shadow-xl">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                                <th className="p-4 rounded-tl-xl font-medium">Player</th>
                                <th className="p-4 font-medium">Role</th>
                                <th className="p-4 font-medium">Age & Mobile</th>
                                <th className="p-4 font-medium">Price</th>
                                <th className="p-4 font-medium">Status / Team</th>
                                <th className="p-4 rounded-tr-xl font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {filteredPlayers.map(player => (
                                <tr key={player.id} className={`hover:bg-brand-darker/50 transition ${player.isActive === false ? 'opacity-50' : ''}`}>
                                    <td className="p-4 flex items-center space-x-3">
                                        {player.photoUrl ? (
                                            <img src={player.photoUrl} alt={player.name} className="w-10 h-10 rounded-full border border-gray-700 object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700"><UserSquare size={20} className="text-gray-500" /></div>
                                        )}
                                        <div>
                                            <span className="font-bold text-white block">{player.name}</span>
                                            {player.isActive === false && <span className="text-xs text-red-500 font-bold">INACTIVE</span>}
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-300 text-sm">{player.playingRole}</td>
                                    <td className="p-4 text-sm">
                                        <div className="text-gray-300">{player.age || '?'} yrs</div>
                                        <div className="text-gray-500 text-xs">{player.mobile}</div>
                                    </td>
                                    <td className="p-4 text-sm">
                                        {player.status === 'SOLD' ? (
                                            <div>
                                                <span className="text-brand-neon font-bold">₹{player.soldPrice?.toLocaleString()}</span>
                                                <div className="text-xs text-gray-500">Base: ₹{player.basePrice?.toLocaleString()}</div>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 font-bold">₹{player.basePrice?.toLocaleString()}</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-sm">
                                        {player.status === 'SOLD' || player.teamId ? (
                                            <div>
                                                <span className="px-2 py-0.5 bg-brand-neon/10 text-brand-neon rounded text-xs font-bold border border-brand-neon/20">SOLD</span>
                                                <div className="text-xs text-gray-400 mt-1">{getTeamName(player.teamId)}</div>
                                            </div>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-xs font-bold border border-gray-700">UNSOLD</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        {player.isActive !== false && (
                                            <button onClick={() => openForceAssign(player)} className="p-2 text-brand-accent hover:text-white transition bg-gray-900 rounded border border-gray-700 hover:border-brand-accent tooltip" title={player.status === 'SOLD' || player.teamId ? 'Reassign Player' : 'Assign Player'}>
                                                <Gavel size={16} />
                                            </button>
                                        )}
                                        <button onClick={() => openEdit(player)} className="p-2 text-gray-400 hover:text-brand-neon transition bg-gray-900 rounded border border-gray-700 hover:border-brand-neon">
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredPlayers.length === 0 && (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500 font-medium">No players found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Player Modal */}
            {isEditOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-brand-dark border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <h3 className="text-xl font-black text-brand-neon uppercase tracking-widest">Edit Player</h3>
                            <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            {errorMsg && <div className="p-3 bg-red-900/30 text-red-400 border border-red-900/50 rounded text-sm font-bold flex items-center"><ShieldAlert size={16} className="mr-2" /> {errorMsg}</div>}

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Player Photo URL</label>
                                <input type="url" name="photoUrl" value={formData.photoUrl} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Player Name</label>
                                    <input required type="text" name="name" value={formData.name} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date of Birth</label>
                                    <input type="date" name="dob" value={formData.dob} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Playing Role</label>
                                    <select name="role" value={formData.role} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon">
                                        <option value="Batsman">Batsman</option>
                                        <option value="Bowler">Bowler</option>
                                        <option value="Allrounder">Allrounder</option>
                                        <option value="Wicket Keeper">Wicket Keeper</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Batting Style</label>
                                    <select name="battingStyle" value={formData.battingStyle} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon">
                                        <option value="Right Hand">Right Hand</option>
                                        <option value="Left Hand">Left Hand</option>
                                        <option value="NA">NA</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Bowling Style</label>
                                    <select name="bowlingStyle" value={formData.bowlingStyle} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon">
                                        <option value="Fast">Fast</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Spin">Spin</option>
                                        <option value="None">None</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mobile No.</label>
                                    <input required type="text" name="mobile" value={formData.mobile} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Base Price</label>
                                    <input required type="number" name="basePrice" value={formData.basePrice} onChange={handleEditChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none focus:border-brand-neon" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Active Status</label>
                                    <select name="isActive" value={String(formData.isActive)} onChange={(e) => setFormData(p => ({ ...p, isActive: e.target.value === 'true' }))} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none">
                                        <option value="true">Active</option>
                                        <option value="false">Soft Deleted (Hidden)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-800 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsEditOpen(false)} className="px-4 py-2 bg-transparent text-white font-medium hover:bg-gray-800 rounded">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-brand-neon text-black font-black uppercase tracking-widest rounded hover:bg-white shadow-[0_0_15px_rgba(57,255,20,0.3)] transition">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Force Assign Modal */}
            {isAssignOpen && currentPlayer && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-brand-dark border border-brand-accent rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-brand-accent/10">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center"><Gavel size={20} className="mr-2 text-brand-accent" /> {currentPlayer.teamId || currentPlayer.status === 'SOLD' ? 'Reassign' : 'Assign'} Player</h3>
                            <button onClick={() => setIsAssignOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleForceAssign} className="p-6 space-y-4">
                            {assignError && <div className="p-3 bg-red-900/30 text-red-400 border border-red-900/50 rounded text-sm font-bold flex items-center"><ShieldAlert size={16} className="mr-2" /> {assignError}</div>}

                            <div className="text-center mb-6 border-b border-gray-800 pb-4">
                                <p className="text-white font-bold text-xl uppercase tracking-wider">{currentPlayer.name}</p>
                                <p className="text-gray-400 font-bold text-sm">Base Price: ₹{currentPlayer.basePrice?.toLocaleString()}</p>
                                {(currentPlayer.status === 'SOLD' || currentPlayer.teamId) && (
                                    <p className="text-brand-accent font-bold text-sm mt-1">Currently Sold Price: ₹{currentPlayer.soldPrice?.toLocaleString()}</p>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Select Franchise</label>
                                    <select required value={assignTarget} onChange={(e) => setAssignTarget(e.target.value)} className="w-full bg-brand-darker border border-gray-700 rounded p-3 text-white outline-none focus:border-brand-accent cursor-pointer">
                                        <option className="bg-brand-dark text-white" value="" disabled>-- Choose a Franchise --</option>
                                        {teams.filter(t => t.isActive !== false).map(t => {
                                            const remaining = getTeamRemainingPurse(t.id, currentPlayer.id);
                                            return (
                                                <option className="bg-brand-dark text-white" key={t.id} value={t.id}>{t.name} (Purse: ₹{remaining.toLocaleString()})</option>
                                            )
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Auction Price Input</label>
                                    <input required type="number" min={currentPlayer.basePrice || 0} value={auctionPrice} onChange={(e) => setAuctionPrice(e.target.value)} className="w-full bg-brand-darker border border-gray-700 rounded p-3 text-brand-neon font-black outline-none focus:border-brand-accent text-lg" placeholder="Price sold for..." />
                                </div>
                            </div>

                            <div className="pt-4 mt-6 border-t border-gray-800 flex justify-end space-x-3">
                                <button type="button" onClick={() => setIsAssignOpen(false)} className="px-4 py-2 bg-transparent text-white font-medium hover:bg-gray-800 rounded transition">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-brand-accent text-white font-black uppercase tracking-widest rounded disabled:opacity-50 hover:bg-white hover:text-brand-accent shadow-[0_0_15px_rgba(255,51,102,0.3)] transition">{currentPlayer.teamId || currentPlayer.status === 'SOLD' ? 'Reassign Now' : 'Assign Now'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
