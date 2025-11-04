import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/navbar.jsx";
import Sidebar from "./components/sidebar.jsx";
import FixturesPanel from "./components/fixtures.jsx";
import TriviaPanel from "./components/trivia.jsx";
import FanRoomPanel from "./components/fanroom.jsx";
import { api } from "./api/api.js";

function useInitialAppData() {
  const [fixtures, setFixtures] = useState([]);
  const [fanRooms, setFanRooms] = useState([]);
  const [trivia, setTrivia] = useState(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [fixturesData, fanRoomsData, triviaData] = await Promise.all([
          api.fetchUpcomingFixtures(),
          api.fetchFanRooms(),
          api.fetchTriviaForDay(),
        ]);

        if (!isMounted) return;

        setFixtures(fixturesData);
        setFanRooms(fanRoomsData);
        setTrivia(triviaData);
      } catch (error) {
        console.error("Failed to load initial dashboard data:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRoomPresenceUpdate = useCallback((roomId, activeUsers) => {
    setFanRooms((prev) =>
      prev.map((room) =>
        room.id === roomId ? { ...room, active_users: activeUsers } : room
      )
    );
  }, []);

  return {
    fixtures,
    fanRooms,
    trivia,
    handleRoomPresenceUpdate,
  };
}

function MainDashboard() {
  const { fixtures, fanRooms, trivia, handleRoomPresenceUpdate } = useInitialAppData();
  const [, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const globalRoom = useMemo(
    () => fanRooms.find((room) => room.is_global),
    [fanRooms]
  );

  const handleJoinFanRoom = useCallback(
    (roomId) => {
      navigate(`/fanroom/${roomId}`);
    },
    [navigate]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-900 text-slate-800 overflow-hidden">
      <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} />

      <div className="flex">
        <Sidebar
          fixtures={fixtures}
          fanRooms={fanRooms}
          onSelectRoom={handleJoinFanRoom}
        />

        <main className="flex-1 p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <FixturesPanel fixtures={fixtures} />
              <TriviaPanel trivia={trivia} />
            </div>

            <aside>
              <FanRoomPanel
                room={globalRoom}
                enforceFavorite={false}
                onPresenceUpdate={handleRoomPresenceUpdate}
              />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function TeamFanRoomPage() {
  const { roomId } = useParams();
  const numericRoomId = Number(roomId);
  const [, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const {
    fixtures,
    fanRooms,
    trivia,
    handleRoomPresenceUpdate,
  } = useInitialAppData();
  const [fetchedRoom, setFetchedRoom] = useState(null);

  const selectedRoom = useMemo(() => {
    if (!Number.isFinite(numericRoomId)) return null;
    return fanRooms.find((room) => room.id === numericRoomId) || null;
  }, [fanRooms, numericRoomId]);

  useEffect(() => {
    let cancelled = false;

    if (selectedRoom || !Number.isFinite(numericRoomId)) {
      setFetchedRoom(selectedRoom);
      return;
    }

    (async () => {
      try {
        const room = await api.fetchFanRoom(numericRoomId);
        if (!cancelled) {
          setFetchedRoom(room);
        }
      } catch (error) {
        console.error("Failed to load fan room detail:", error);
        if (!cancelled) {
          setFetchedRoom(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [numericRoomId, selectedRoom]);

  const roomForChat = selectedRoom || fetchedRoom;

  const handleJoinFanRoom = useCallback(
    (targetRoomId) => {
      navigate(`/fanroom/${targetRoomId}`);
    },
    [navigate]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-900 text-slate-800 overflow-hidden">
      <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} />

      <div className="pt-16 flex">
        <Sidebar
          fixtures={fixtures}
          fanRooms={fanRooms}
          onSelectRoom={handleJoinFanRoom}
        />

        <main className="flex-1 p-6 space-y-4">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-sky-700 underline hover:text-sky-500"
          >
            ← Back to dashboard
          </button>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <FanRoomPanel
                room={roomForChat}
                onPresenceUpdate={handleRoomPresenceUpdate}
              />
            </div>
            <aside className="space-y-4">
              <FixturesPanel fixtures={fixtures} />
              <TriviaPanel trivia={trivia} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainDashboard />} />
      <Route path="/fanroom/:roomId" element={<TeamFanRoomPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={process.env.PUBLIC_URL || "/"}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
