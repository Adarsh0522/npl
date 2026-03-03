import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AlertCircle } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check role to route properly
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const role = userDoc.data().role;
                if (role === 'organizer') {
                    navigate('/admin-dashboard');
                } else if (role === 'owner') {
                    navigate('/owner-dashboard');
                } else {
                    navigate('/');
                }
            } else {
                setError('User record not found in database.');
                await auth.signOut();
            }
        } catch (err) {
            console.error(err);
            setError('Invalid email or password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-brand-darker text-white px-4">
            <div className="max-w-md w-full p-8 bg-brand-dark rounded-xl border border-gray-800 shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-brand-neon/20 rounded-bl-full blur-xl"></div>

                <h2 className="text-3xl font-black text-center text-white mb-2">Welcome Back</h2>
                <p className="text-center text-gray-500 mb-8 font-medium">Sign in to your NPL account</p>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start text-red-400">
                        <AlertCircle size={20} className="mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full bg-brand-darker border border-gray-700 rounded-lg p-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all duration-200"
                            placeholder="admin@npl.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full bg-brand-darker border border-gray-700 rounded-lg p-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all duration-200"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-brand-neon text-black font-black py-3.5 rounded-lg hover:bg-white transition-colors duration-300 mt-4 shadow-[0_0_15px_rgba(57,255,20,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] flex justify-center items-center"
                    >
                        {loading ? (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : "SIGN IN"}
                    </button>
                </form>
            </div>
        </div>
    );
}
