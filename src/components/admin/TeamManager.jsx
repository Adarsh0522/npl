import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Edit2, ShieldAlert, Plus, ShieldCheck, X, Users } from 'lucide-react';

export const TeamManager = () => {
    const [teams, setTeams] = useState([]);
    const [owners, setOwners] = useState([]);
    const [allPlayers, setAllPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [currentTeam, setCurrentTeam] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Squad View States
    const [isSquadOpen, setIsSquadOpen] = useState(false);
    const [squadTeam, setSquadTeam] = useState(null);

    const defaultFormData = {
        name: '',
        logoUrl: '',
        ownerId: '',
        ownerPhotoUrl: '',
        captainId: '',
        totalBudget: 50000,
        minPlayers: 11,
        maxPlayers: 15,
        isActive: true
    };
    const [formData, setFormData] = useState(defaultFormData);

    useEffect(() => {
        const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
            const tData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
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

    // Auto remove captainId if player leaves squad
    useEffect(() => {
        if (teams.length > 0 && allPlayers.length > 0) {
            teams.forEach(team => {
                if (team.captainId) {
                    const teamPlayers = allPlayers.filter(p => p.teamId === team.id);
                    const captainStillInSquad = teamPlayers.some(p => p.id === team.captainId);
                    if (!captainStillInSquad) {
                        updateDoc(doc(db, 'teams', team.id), { captainId: null }).catch(console.error);
                    }
                }
            });
        }
    }, [teams, allPlayers]);

    // Dynamic Team Stats Helper
    const getTeamStats = (teamId, totalBudget) => {
        const teamPlayers = allPlayers.filter(p => p.teamId === teamId);
        const totalSpent = teamPlayers.reduce((sum, p) => sum + (Number(p.soldPrice) || 0), 0);
        const remainingPurse = totalBudget - totalSpent;
        return { squadCount: teamPlayers.length, totalSpent, remainingPurse, teamPlayers };
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
        }));
    };

    const validateDuplicate = (name, excludeId = null) => {
        return teams.some(t => t.name.toLowerCase() === name.toLowerCase() && t.id !== excludeId);
    };

    const handleAddTeam = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (validateDuplicate(formData.name)) {
            setErrorMsg('A team with this name already exists.');
            return;
        }

        try {
            const teamId = formData.name.replace(/\s+/g, '-').toLowerCase() + '-' + Date.now().toString().slice(-4);
            const teamRef = doc(db, 'teams', teamId);
            await setDoc(teamRef, {
                ...formData,
                createdAt: new Date().toISOString()
            });
            setIsAddOpen(false);
            setFormData(defaultFormData);
        } catch (err) {
            setErrorMsg(err.message);
        }
    };

    const handleEditTeam = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        if (validateDuplicate(formData.name, currentTeam.id)) {
            setErrorMsg('A team with this name already exists.');
            return;
        }

        const stats = getTeamStats(currentTeam.id, formData.totalBudget);
        if (stats.remainingPurse < 0) {
            setErrorMsg('Total budget cannot be less than the total amount already spent.');
            return;
        }

        if (formData.captainId) {
            const isInSquad = stats.teamPlayers.some(p => p.id === formData.captainId);
            if (!isInSquad) {
                setErrorMsg('Selected captain is not in the squad.');
                return;
            }
        }

        try {
            const teamRef = doc(db, 'teams', currentTeam.id);
            await updateDoc(teamRef, {
                name: formData.name,
                logoUrl: formData.logoUrl,
                ownerId: formData.ownerId,
                ownerPhotoUrl: formData.ownerPhotoUrl || '',
                captainId: formData.captainId || null,
                totalBudget: formData.totalBudget,
                minPlayers: formData.minPlayers,
                maxPlayers: formData.maxPlayers,
                isActive: formData.isActive
            });
            setIsEditOpen(false);
            setCurrentTeam(null);
        } catch (err) {
            setErrorMsg(err.message);
        }
    };

    const openEdit = (team) => {
        setCurrentTeam(team);
        setFormData({
            name: team.name,
            logoUrl: team.logoUrl || '',
            ownerId: team.ownerId || '',
            ownerPhotoUrl: team.ownerPhotoUrl || '',
            captainId: team.captainId || '',
            totalBudget: team.totalBudget || 50000,
            minPlayers: team.minPlayers || 11,
            maxPlayers: team.maxPlayers || 15,
            isActive: team.isActive !== false
        });
        setIsEditOpen(true);
    };

    const openSquad = (team) => {
        setSquadTeam(team);
        setIsSquadOpen(true);
    };

    const getOwnerName = (id) => {
        const owner = owners.find(o => o.id === id);
        return owner ? owner.name || owner.email : 'No Owner';
    };

    const currentEditTeamPlayers = currentTeam ? allPlayers.filter(p => p.teamId === currentTeam.id) : [];
    const squadModalPlayers = squadTeam ? allPlayers.filter(p => p.teamId === squadTeam.id) : [];
    const squadTeamStats = squadTeam ? getTeamStats(squadTeam.id, squadTeam.totalBudget) : null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center"><span className="w-2 h-6 bg-brand-accent mr-3 rounded-full block"></span>Franchises Overview</h2>
                <button onClick={() => { setFormData(defaultFormData); setIsAddOpen(true); setCurrentTeam(null); }} className="flex items-center px-4 py-2 bg-brand-neon text-black rounded font-bold hover:bg-white transition text-sm">
                    <Plus size={16} className="mr-2" />
                    New Team
                </button>
            </div>

            {loading ? <div className="text-gray-400">Loading teams...</div> : (
                <div className="bg-brand-dark rounded-xl border border-gray-800 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-900/50 border-b border-gray-800 text-gray-400 text-sm uppercase tracking-wider">
                                <th className="p-4 rounded-tl-xl font-medium">Team</th>
                                <th className="p-4 font-medium">Owner</th>
                                <th className="p-4 font-medium">Budget</th>
                                <th className="p-4 font-medium">Squad</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 rounded-tr-xl font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {teams.map(team => {
                                const stats = getTeamStats(team.id, team.totalBudget);
                                return (
                                    <tr key={team.id} className="hover:bg-brand-darker/50 transition">
                                        <td className="p-4">
                                            <div className="flex items-center space-x-3">
                                                {team.logoUrl ? (
                                                    <img src={team.logoUrl} alt={team.name} className="w-8 h-8 rounded-full border border-gray-700 bg-black object-cover" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                                                        <ShieldCheck size={14} className="text-gray-500" />
                                                    </div>
                                                )}
                                                <span className="font-black text-white">{team.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center space-x-2">
                                                {team.ownerPhotoUrl && <img src={team.ownerPhotoUrl} alt="Owner" className="w-6 h-6 rounded-full object-cover border border-gray-700" />}
                                                <span className="text-gray-400 text-sm">{getOwnerName(team.ownerId)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm">
                                                <p className="text-brand-neon font-bold">₹{stats.remainingPurse.toLocaleString()}</p>
                                                <p className="text-xs text-gray-500 font-medium">/ ₹{team.totalBudget?.toLocaleString()}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-gray-300">
                                            {stats.squadCount} <span className="text-gray-600 font-normal">/ {team.maxPlayers}</span>
                                        </td>
                                        <td className="p-4">
                                            {team.isActive === false ? (
                                                <span className="px-2 py-1 bg-red-900/30 text-red-500 rounded text-xs font-bold border border-red-900/50">Inactive</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-brand-neon/10 text-brand-neon rounded text-xs font-bold border border-brand-neon/20">Active</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            <button onClick={() => openSquad(team)} className="p-2 text-brand-neon hover:text-white transition bg-gray-900 rounded border border-gray-700 hover:border-brand-neon tooltip" title="View Squad">
                                                <Users size={16} />
                                            </button>
                                            <button onClick={() => openEdit(team)} className="p-2 text-gray-400 hover:text-brand-neon transition bg-gray-900 rounded border border-gray-700 hover:border-brand-neon" title="Edit Team">
                                                <Edit2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {teams.length === 0 && (
                                <tr><td colSpan="6" className="p-8 text-center text-gray-500 font-medium">No teams registered matching the criteria.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal for Add / Edit */}
            {(isAddOpen || isEditOpen) && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-brand-dark border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <h3 className="text-xl font-black text-brand-neon uppercase tracking-widest">{isEditOpen ? 'Edit Team' : 'Register New Team'}</h3>
                            <button onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <form onSubmit={isEditOpen ? handleEditTeam : handleAddTeam} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            {errorMsg && <div className="p-3 bg-red-900/30 text-red-400 border border-red-900/50 rounded text-sm font-bold flex items-center"><ShieldAlert size={16} className="mr-2" /> {errorMsg}</div>}

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Team Name</label>
                                <input required type="text" name="name" value={formData.name} onChange={handleFormChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white focus:border-brand-neon focus:outline-none transition" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Logo URL (Optional)</label>
                                <input type="url" name="logoUrl" value={formData.logoUrl} onChange={handleFormChange} placeholder="https://..." className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white focus:border-brand-neon focus:outline-none transition" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Owner Photo URL (Optional)</label>
                                <input type="url" name="ownerPhotoUrl" value={formData.ownerPhotoUrl} onChange={handleFormChange} placeholder="https://..." className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white focus:border-brand-neon focus:outline-none transition" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Select Owner</label>
                                    <select name="ownerId" value={formData.ownerId} onChange={handleFormChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none">
                                        <option value="">-- No Owner --</option>
                                        {owners.map(o => (
                                            <option key={o.id} value={o.id}>{o.name || o.email}</option>
                                        ))}
                                    </select>
                                </div>
                                {isEditOpen && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Team Captain</label>
                                        <select name="captainId" value={formData.captainId} onChange={handleFormChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white outline-none">
                                            <option value="">-- No Captain --</option>
                                            {currentEditTeamPlayers.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.playingRole})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Total Budget</label>
                                    <input required type="number" name="totalBudget" value={formData.totalBudget} onChange={handleFormChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Active Status</label>
                                    <select name="isActive" value={formData.isActive} onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white">
                                        <option value="true">Active (Live)</option>
                                        <option value="false">Soft Deleted (Hidden)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Min Players</label>
                                    <input required type="number" name="minPlayers" value={formData.minPlayers} onChange={handleFormChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Max Players</label>
                                    <input required type="number" name="maxPlayers" value={formData.maxPlayers} onChange={handleFormChange} className="w-full bg-brand-darker border border-gray-700 rounded p-2 text-white" />
                                </div>
                            </div>

                            <div className="pt-4 mt-4 border-t border-gray-800 flex justify-end space-x-3 sticky bottom-0 bg-brand-dark pb-2">
                                <button type="button" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }} className="px-4 py-2 bg-transparent text-white font-medium hover:bg-gray-800 rounded transition">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-brand-neon text-black font-black uppercase tracking-widest rounded hover:bg-white shadow-[0_0_15px_rgba(57,255,20,0.3)] transition">{isEditOpen ? 'Save Changes' : 'Create Team'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Squad View Modal */}
            {isSquadOpen && squadTeam && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-brand-dark border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                            <div>
                                <h3 className="text-xl font-black text-brand-accent uppercase tracking-widest flex items-center gap-3">
                                    {squadTeam.logoUrl && <img src={squadTeam.logoUrl} alt="Logo" className="w-8 h-8 rounded-full border border-gray-700 object-cover" />}
                                    {squadTeam.name} Roster
                                </h3>
                                <p className="text-sm font-bold mt-1 text-brand-neon">Remaining Budget: ₹{squadTeamStats?.remainingPurse?.toLocaleString()}</p>
                            </div>
                            <button onClick={() => setIsSquadOpen(false)} className="text-gray-400 hover:text-white"><X size={24} /></button>
                        </div>

                        <div className="p-0 overflow-y-auto hide-scrollbar">
                            {squadModalPlayers.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 font-medium">No players in squad yet.</div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-brand-darker border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                                        <tr>
                                            <th className="p-4 font-medium">Player</th>
                                            <th className="p-4 font-medium">Role</th>
                                            <th className="p-4 font-medium">Age</th>
                                            <th className="p-4 rounded-tr-xl font-medium text-right">Bought For</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800/50">
                                        {squadModalPlayers.map(p => (
                                            <tr key={p.id} className="hover:bg-brand-darker/50 transition">
                                                <td className="p-4 flex items-center space-x-3">
                                                    {p.photoUrl ? (
                                                        <img src={p.photoUrl} alt={p.name} className="w-8 h-8 rounded-full border border-gray-700 object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center"><Users size={14} className="text-gray-500" /></div>
                                                    )}
                                                    <span className="font-bold text-white block">
                                                        {p.name}
                                                        {p.id === squadTeam.captainId && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 px-1.5 py-0.5 rounded uppercase font-black">C</span>}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-300 text-sm">{p.playingRole}</td>
                                                <td className="p-4 text-gray-300 text-sm">{p.age || '?'}</td>
                                                <td className="p-4 text-brand-neon font-bold text-sm text-right">₹{p.soldPrice?.toLocaleString() || p.basePrice?.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex justify-between items-center text-sm font-bold text-gray-400">
                            <span>Total Squad: <span className="text-white">{squadModalPlayers.length}</span></span>
                            <span>Limit: <span className="text-white">{squadTeam.maxPlayers}</span></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
