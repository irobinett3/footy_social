import React from "react";
import Navbar from "../components/navbar.jsx";

export default function LiveGameRoom() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-900 text-slate-800 flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md p-6 max-w-xl w-full text-center">
          <h1 className="text-2xl font-semibold mb-2">Live Game Chat</h1>
          <p className="text-sm text-gray-600">
            This live match room will be available here. Stay tuned!
          </p>
        </div>
      </main>
    </div>
  );
}
