import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthModal from "./AuthModal";
import UserProfile from "./UserProfile";
import { getTeamLogoUrlByName } from "../utils/teamLogos";

export default function Navbar({ onToggleSidebar }) {
  const navigate = useNavigate();
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
     <header className="w-full bg-gray-900 text-slate-100 shadow-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="md:hidden p-2 rounded hover:bg-gray-100" onClick={onToggleSidebar}>
            ☰
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-2xl font-bold hover:text-sky-400 transition-colors cursor-pointer"
          >
            FootySocial
          </button>
          <div className="hidden sm:block text-base text-gray-400 ml-4">
            Scores • Chat • Trivia • Fan Rooms
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input className="hidden md:block border rounded px-3 py-2 text-sm" placeholder="Search teams, fixtures..." />
          
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-base text-gray-300">
                Welcome, {user?.first_name || user?.username}!
              </span>
              <button
                onClick={handleProfileClick}
                className="flex items-center gap-2 px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 text-sm font-medium"
              >
                <div className="w-7 h-7 bg-white bg-opacity-20 rounded-full flex items-center justify-center overflow-hidden">
                  {favoriteLogo ? (
                    <img src={favoriteLogo} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm">{user?.first_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                Profile
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSignIn}
                className="px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 text-sm font-medium"
              >
                Sign in
              </button>
              <button
                onClick={handleSignUp}
                className="px-4 py-2 rounded border border-sky-600 text-sky-600 hover:bg-sky-50 text-sm font-medium"
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
