import React, { useState } from 'react';
import Papa from 'papaparse';
import { collection, doc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuction } from '../../context/AuctionContext';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';

export const PlayerUploader = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '', details: [] });
    const { auctionState } = useAuction();

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            // Clear previous messages on new file select
            setMessage({ text: '', type: '', details: [] });
        }
    };

    const processData = async () => {
        if (!file) {
            setMessage({ text: 'Please select a CSV file first.', type: 'error', details: [] });
            return;
        }

        setLoading(true);
        // Explicitly clear stale state right before processing
        setMessage({ text: '', type: '', details: [] });

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const rawPlayers = results.data;
                    if (rawPlayers.length === 0) {
                        setMessage({ text: 'No data found in CSV.', type: 'error', details: [] });
                        setLoading(false);
                        return;
                    }

                    const calculateAge = (dobString) => {
                        if (!dobString) return 0;
                        const today = new Date();
                        const birthDate = new Date(dobString);
                        let age = today.getFullYear() - birthDate.getFullYear();
                        const m = today.getMonth() - birthDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                            age--;
                        }
                        return isNaN(age) ? 0 : age;
                    };

                    const validPlayers = [];
                    const skippedMobiles = [];

                    // Keep a small local Set just for rows INSIDE the exact same CSV 
                    // to prevent duplicate inserts from the same sheet hitting DB at the same time
                    const processedMobilesThisRun = new Set();

                    // Loop linearly through rows to validate against Firestore one by one
                    for (const row of rawPlayers) {
                        // Normalize row keys (trim spaces)
                        const normalizedRow = {};
                        Object.keys(row).forEach(key => {
                            normalizedRow[key.trim()] = row[key];
                        });

                        // Helper to find field by keyword
                        const findField = (keyword) => {
                            const key = Object.keys(normalizedRow).find(k =>
                                k.toLowerCase().includes(keyword.toLowerCase())
                            );
                            return key ? normalizedRow[key] : "";
                        };

                        let name = findField("full name");
                        let mobile = findField("mobile");
                        let dob = findField("date of birth");
                        let role = findField("playing role");
                        let battingStyle = findField("batting style");
                        let bowlingStyle = findField("bowling style");
                        let photoUrl = findField("photo");

                        // Extract base price if it exists, otherwise it will fallback to auction state
                        let basePrice = findField("base price") || findField("basePrice");

                        // Normalize mobile
                        mobile = mobile.toString().replace(/\D/g, "").trim();

                        if (mobile.length !== 10) {
                            skippedMobiles.push(`${name} - Invalid Mobile`);
                            continue;
                        }

                        if (!name || !mobile) {
                            console.log("Skipping due to missing name/mobile:", row);
                            if (name || mobile) {
                                skippedMobiles.push(`${name || 'Unknown'} (Missing ${!name ? 'Name' : 'Mobile'})`);
                            }
                            continue;
                        }

                        console.log("Processing:", name, mobile);

                        // 1. Check if we already processed this mobile IN THIS CSV RUN
                        if (processedMobilesThisRun.has(mobile)) {
                            skippedMobiles.push(`${name} (${mobile}) - Duplicate in CSV`);
                            continue;
                        }

                        // 2. CHECK FIRESTORE DIRECTLY per row (This replaces the old cached Set logic)
                        const q = query(collection(db, "players"), where("mobile", "==", mobile));
                        const snapshot = await getDocs(q);

                        // If document exists in Firestore, skip entirely
                        if (!snapshot.empty) {
                            skippedMobiles.push(`${name} (${mobile}) - Exists in DB`);
                            continue;
                        }

                        // Passed duplicate checks
                        processedMobilesThisRun.add(mobile);

                        const age = calculateAge(dob);

                        name = name.trim();
                        role = role?.trim();
                        battingStyle = battingStyle?.trim();
                        bowlingStyle = bowlingStyle?.trim();
                        photoUrl = photoUrl?.trim();

                        validPlayers.push({
                            name: name,
                            mobile: mobile,
                            dob: dob || '',
                            age: age,
                            playingRole: role || 'Batsman',
                            battingStyle: battingStyle || null,
                            bowlingStyle: bowlingStyle || 'None',
                            photoUrl: photoUrl || 'https://via.placeholder.com/150',
                            basePrice: Number(basePrice) || auctionState?.basePrice || 1000,
                            sold: false,
                            teamId: null,
                            isActive: true,
                            roundEligible: true,
                            createdAt: new Date().toISOString()
                        });
                    }

                    if (validPlayers.length === 0) {
                        setMessage({
                            text: 'No new players to import. All valid mobiles already exist in Database.',
                            type: 'error',
                            details: skippedMobiles
                        });
                        setLoading(false);
                        return;
                    }

                    // Firestore batch allows up to 500 operations
                    const chunks = [];
                    for (let i = 0; i < validPlayers.length; i += 500) {
                        chunks.push(validPlayers.slice(i, i + 500));
                    }

                    for (const chunk of chunks) {
                        const batch = writeBatch(db);
                        chunk.forEach((playerObj) => {
                            const newPlayerRef = doc(collection(db, 'players'));
                            batch.set(newPlayerRef, playerObj);
                        });
                        await batch.commit();
                    }

                    let successText = `Successfully imported ${validPlayers.length} players!`;
                    if (skippedMobiles.length > 0) {
                        successText += ` Skipped ${skippedMobiles.length} duplicates.`;
                    }

                    setMessage({ text: successText, type: 'success', details: skippedMobiles });
                    setFile(null);

                    // safely clear input
                    const fileInput = document.getElementById('csv-upload');
                    if (fileInput) fileInput.value = '';

                } catch (error) {
                    console.error('[CSV Import] Upload Error:', error);
                    setMessage({ text: 'Error uploading data to Firestore.', type: 'error', details: [] });
                } finally {
                    setLoading(false);
                }
            },
            error: (error) => {
                console.error('[CSV Import] Parse Error:', error);
                setMessage({ text: 'Error parsing CSV file.', type: 'error', details: [] });
                setLoading(false);
            }
        });
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400 mb-4">
                Upload a CSV exported directly from Google Forms.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4">
                <label className="flex-1 w-full flex flex-col items-center px-4 py-6 bg-brand-darker text-brand-neon rounded-lg shadow-lg tracking-wide uppercase border border-brand-neon/30 cursor-pointer hover:bg-brand-neon hover:text-black transition-colors duration-300">
                    <Upload size={24} className="mb-2" />
                    <span className="text-sm leading-normal font-bold">Select a CSV</span>
                    <input type="file" id="csv-upload" accept=".csv" className="hidden" onChange={handleFileChange} />
                </label>

                <button
                    onClick={processData}
                    disabled={!file || loading}
                    className={`w-full sm:w-auto px-8 py-6 rounded-lg font-black tracking-wider shadow-lg transition-all ${!file || loading
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-brand-neon text-black hover:bg-green-400 hover:shadow-[0_0_15px_rgba(57,255,20,0.5)]'
                        }`}
                >
                    {loading ? 'Uploading...' : 'IMPORT'}
                </button>
            </div>

            {file && <p className="text-sm text-gray-300">Selected: {file.name}</p>}

            {message.text && (
                <div className={`p-4 rounded-lg flex flex-col items-start ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                    <div className="flex items-center">
                        {message.type === 'success' ? <CheckCircle size={20} className="mr-2 mt-0.5" /> : <AlertCircle size={20} className="mr-2 mt-0.5" />}
                        <span className="text-sm font-bold">{message.text}</span>
                    </div>
                    {message.details && message.details.length > 0 && (
                        <div className="mt-2 pl-7 w-full">
                            <p className="text-xs uppercase font-bold mb-1 opacity-80">Skipped Issues:</p>
                            <ul className="text-xs w-full max-h-32 overflow-y-auto space-y-1 list-disc pl-4 text-gray-400">
                                {message.details.map((d, i) => (
                                    <li key={i}>{d}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
