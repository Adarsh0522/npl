/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'organizer' | 'owner' | null
    const [userTeamId, setUserTeamId] = useState(null); // only if owner
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            if (user) {
                setCurrentUser(user);
                try {
                    // Fetch role from users collection
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setUserRole(data.role);

                        if (data.role === 'owner') {
                            let resolvedTeamId = data.teamId || null;

                            // 1️⃣ ROOT CAUSE FIX: 
                            // If teamId isn't on the user doc, fetch it dynamically by ownerId
                            if (!resolvedTeamId) {
                                const q = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
                                const teamSnap = await getDocs(q);
                                if (!teamSnap.empty) {
                                    resolvedTeamId = teamSnap.docs[0].id;
                                    console.log("Found team by ownerId mapping:", resolvedTeamId);
                                }
                            }

                            console.log("Current User UID:", user.uid);
                            console.log("Resolved Team ID:", resolvedTeamId);

                            setUserTeamId(resolvedTeamId);
                        }
                    } else {
                        setUserRole(null);
                        setUserTeamId(null);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
                setCurrentUser(null);
                setUserRole(null);
                setUserTeamId(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userRole,
        userTeamId,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
