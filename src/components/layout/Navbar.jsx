import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Home, Users, UserSquare, Radio, LogIn, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';

export const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, userRole } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error('Logout error', error);
        }
    };

    const navLinks = [
        { name: 'Home', path: '/', icon: <Home size={18} /> },
        { name: 'Teams', path: '/teams', icon: <Users size={18} /> },
        { name: 'Players', path: '/players', icon: <UserSquare size={18} /> },
        { name: 'Live Auction', path: '/live', icon: <Radio size={18} className="text-red-500 animate-pulse" /> },
    ];

    return (
        <nav className="bg-brand-dark border-b border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link to="/" className="flex-shrink-0 flex items-center">
                            <span className="text-2xl font-black text-brand-neon tracking-tighter italic">NPL</span>
                            <span className="ml-2 text-white font-bold hidden sm:block">AUCTION '26</span>
                        </Link>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${location.pathname === link.path
                                    ? 'bg-gray-800 text-brand-neon'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                <span className="mr-2">{link.icon}</span>
                                {link.name}
                            </Link>
                        ))}

                        {currentUser ? (
                            <div className="flex items-center space-x-4 ml-4 pl-4 border-l border-gray-700">
                                <Link
                                    to={userRole === 'organizer' ? '/admin-dashboard' : '/owner-dashboard'}
                                    className="flex items-center text-gray-300 hover:text-brand-neon transition-colors text-sm font-medium"
                                >
                                    <LayoutDashboard size={18} className="mr-2" />
                                    Dashboard
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center text-gray-400 hover:text-red-400 transition-colors text-sm font-medium"
                                >
                                    <LogOut size={18} className="mr-2" />
                                    Logout
                                </button>
                            </div>
                        ) : null}
                    </div>

                    {/* Mobile menu button */}
                    <div className="flex items-center md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isOpen && (
                <div className="md:hidden bg-brand-dark border-b border-gray-800">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={() => setIsOpen(false)}
                                className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${location.pathname === link.path
                                    ? 'bg-gray-800 text-brand-neon'
                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                <span className="mr-3">{link.icon}</span>
                                {link.name}
                            </Link>
                        ))}

                        {currentUser && (
                            <>
                                <div className="border-t border-gray-700 my-2 pt-2"></div>
                                <Link
                                    to={userRole === 'organizer' ? '/admin-dashboard' : '/owner-dashboard'}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                                >
                                    <LayoutDashboard size={18} className="mr-3" />
                                    Dashboard
                                </Link>
                                <button
                                    onClick={() => { handleLogout(); setIsOpen(false); }}
                                    className="w-full flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-red-400"
                                >
                                    <LogOut size={18} className="mr-3" />
                                    Logout
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
};
