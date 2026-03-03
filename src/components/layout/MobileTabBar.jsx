import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Users, UserSquare, Radio } from 'lucide-react';

export const MobileTabBar = () => {
    const location = useLocation();

    const tabs = [
        { name: 'Home', path: '/', icon: <Home size={20} /> },
        { name: 'Teams', path: '/teams', icon: <Users size={20} /> },
        { name: 'Live', path: '/live', icon: <Radio size={22} className={location.pathname === '/live' ? 'text-red-500 animate-pulse' : ''} /> },
        { name: 'Players', path: '/players', icon: <UserSquare size={20} /> },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-brand-dark border-t border-gray-800 z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                {tabs.map((tab) => {
                    const isActive = location.pathname === tab.path;
                    return (
                        <Link
                            key={tab.path}
                            to={tab.path}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? 'text-brand-neon' : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <div>{tab.icon}</div>
                            <span className="text-[10px] font-medium">{tab.name}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};
