import { useState, useEffect, useRef } from 'react';
import { useAuction } from '../context/AuctionContext';

/**
 * Shared hook for display-only countdown timer.
 * All pages use this to compute remaining time from the same Firestore source.
 * Does NOT write to Firestore or trigger any resolution logic.
 */
export const useAuctionTimer = () => {
    const { auctionState } = useAuction();
    const [timeLeft, setTimeLeft] = useState(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        const isLive = auctionState?.status === 'LIVE';
        const timerStartedAt = auctionState?.timerStartedAt;
        const timerDuration = auctionState?.timerDuration || 30000;

        if (!isLive || !timerStartedAt) {
            setTimeLeft(null);
            return;
        }

        // Convert Firestore Timestamp to millis
        const startMs = typeof timerStartedAt?.toMillis === 'function'
            ? timerStartedAt.toMillis()
            : typeof timerStartedAt?.seconds === 'number'
                ? timerStartedAt.seconds * 1000
                : timerStartedAt;

        if (!startMs || isNaN(startMs)) {
            setTimeLeft(null);
            return;
        }

        const endsAt = startMs + timerDuration;

        const computeRemaining = () => {
            const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
            return remaining;
        };

        // Set initial value immediately
        setTimeLeft(computeRemaining());

        // Update every second for display
        intervalRef.current = setInterval(() => {
            const remaining = computeRemaining();
            setTimeLeft(remaining);

            if (remaining <= 0) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [auctionState?.status, auctionState?.timerStartedAt, auctionState?.timerDuration, auctionState?.currentPlayerId]);

    const isExpired = timeLeft !== null && timeLeft <= 0;

    return { timeLeft, isExpired };
};
