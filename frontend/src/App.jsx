import React, { useEffect, useState } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/navbar.jsx";
import Sidebar from "./components/sidebar.jsx";
import FixturesPanel from "./components/fixtures.jsx";
import TriviaPanel from "./components/trivia.jsx";
import FanRoomPanel from "./components/fanroom.jsx";
import { api } from "./api/api.js";

function AppContent() {
  const [fixtures, setFixtures] = useState([]);
  const [fanRooms, setFanRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [trivia, setTrivia] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setFixtures(await api.fetchUpcomingFixtures());
      setFanRooms(await api.fetchFanRooms());
      setTrivia(await api.fetchTriviaForDay());
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} />

      <div className="flex">
        <Sidebar fixtures={fixtures} fanRooms={fanRooms} onSelectRoom={setSelectedRoom} />
        <main className="flex-1 p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <FixturesPanel fixtures={fixtures} />
              <TriviaPanel trivia={trivia} />
            </div>
            <aside>
              <FanRoomPanel roomId={selectedRoom} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
