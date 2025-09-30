import React from "react";

export default function Navbar({ onToggleSidebar }) {
  return (
    <header className="w-full bg-white shadow-md px-4 py-3 flex items-center justify-between">
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
        <button className="px-3 py-1 rounded bg-sky-600 text-white">Sign in</button>
      </div>
    </header>
  );
}
