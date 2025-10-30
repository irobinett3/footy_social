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
  const [, setSidebarOpen] = useState(false);

  useEffect(() => {
  (async () => {
    const fixturesData = await api.fetchUpcomingFixtures();
    const fanRoomsData = await api.fetchFanRooms();
    const triviaData = await api.fetchTriviaForDay();

    console.log("Fetched trivia in App.jsx:", triviaData);

    setFixtures(fixturesData);
    setFanRooms(fanRoomsData);
    setTrivia(triviaData);
  })();
}, []);

  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-900 text-slate-800 overflow-hidden">
    <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} />

    <div className="pt-16 flex">
      <Sidebar
        fixtures={fixtures}
        fanRooms={fanRooms}
        onSelectRoom={setSelectedRoom}
      />

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
