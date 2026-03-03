import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuctionProvider } from './context/AuctionContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Navbar } from './components/layout/Navbar';
import { MobileTabBar } from './components/layout/MobileTabBar';
import { Footer } from './components/layout/Footer';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import LiveAuction from './pages/LiveAuction';
import AdminDashboard from './pages/AdminDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import Teams from './pages/Teams';
import Players from './pages/Players';
import TeamDetailsPage from './pages/TeamDetailsPage';

function App() {
  return (
    <AuthProvider>
      <AuctionProvider>
        <Router>
          <div className="min-h-screen bg-brand-darker font-sans text-gray-100 flex flex-col">
            <Navbar />

            <main className="flex-grow">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/live" element={<LiveAuction />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/teams/:teamId" element={<TeamDetailsPage />} />
                <Route path="/players" element={<Players />} />

                {/* Auth Route */}
                <Route path="/login" element={<Login />} />

                {/* Protected Organizer Routes */}
                <Route
                  path="/admin-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['organizer']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Protected Owner Routes */}
                <Route
                  path="/owner-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['owner']}>
                      <OwnerDashboard />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>

            <Footer />
            <MobileTabBar />
          </div>
        </Router>
      </AuctionProvider>
    </AuthProvider>
  );
}

export default App;
