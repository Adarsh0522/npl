/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const AuctionContext = createContext();

export const useAuction = () => useContext(AuctionContext);

export const AuctionProvider = ({ children }) => {
    const [auctionState, setAuctionState] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Listen to the global auction settings
        const auctionRef = doc(db, 'settings', 'auction');

        const unsubscribe = onSnapshot(auctionRef, (docSnap) => {
            if (docSnap.exists()) {
                setAuctionState(docSnap.data());
            } else {
                setAuctionState(null);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching auction state:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const value = {
        auctionState,
        loading
    };

    return (
        <AuctionContext.Provider value={value}>
            {children}
        </AuctionContext.Provider>
    );
};
