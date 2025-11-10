import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import AuthModal from "./AuthModal";
import UserProfile from "./UserProfile";
import { getTeamLogoUrlByName } from "../utils/teamLogos";

export default function Navbar({ onToggleSidebar }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [favoriteLogo, setFavoriteLogo] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (user?.favorite_team) {
        const url = await getTeamLogoUrlByName(user.favorite_team);
        if (mounted) setFavoriteLogo(url);
      } else {
        if (mounted) setFavoriteLogo('');
      }
    })();
    return () => { mounted = false; };
  }, [user?.favorite_team]);

  const handleSignIn = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleSignUp = () => {
    setAuthMode('signup');
    setShowAuthModal(true);
  };

  const handleProfileClick = () => {
    setShowProfile(true);
  };

  const handleLogout = () => {
    logout();
    setShowProfile(false);
  };

  return (
    <>
     <header className="w-full bg-gray-900 text-slate-100 shadow-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 rounded hover:bg-gray-100" onClick={onToggleSidebar}>
            ☰
          </button>
          <div className="text-xl font-bold">FootySocial</div>
          <div className="hidden sm:block text-sm text-gray-500 ml-4">
            Scores • Chat • Trivia • Fan Rooms
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input className="hidden md:block border rounded px-2 py-1" placeholder="Search teams, fixtures..." />
          
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-gray-600">
                Welcome, {user?.first_name || user?.username}!
              </span>
              <button
                onClick={handleProfileClick}
                className="flex items-center gap-2 px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700"
              >
                <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center overflow-hidden">
                  {favoriteLogo ? (
                    <img src={favoriteLogo} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span className="text-xs">{user?.first_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                Profile
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSignIn}
                className="px-3 py-1 rounded bg-sky-600 text-white hover:bg-sky-700"
              >
                Sign in
              </button>
              <button
                onClick={handleSignUp}
                className="px-3 py-1 rounded border border-sky-600 text-sky-600 hover:bg-sky-50"
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
      />

      <UserProfile
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />
    </>
  );
}
