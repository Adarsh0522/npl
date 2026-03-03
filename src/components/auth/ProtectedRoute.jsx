import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
    const { currentUser, userRole, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-darker text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-neon"></div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // If logged in but wrong role, send them to their respective dashboard or home
        if (userRole === 'organizer') return <Navigate to="/admin-dashboard" replace />;
        if (userRole === 'owner') return <Navigate to="/owner-dashboard" replace />;
        return <Navigate to="/" replace />;
    }

    return children;
};
