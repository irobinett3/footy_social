import React from "react";
import { formatDate } from "../utils/formatDate.js";

export default function Sidebar({ fixtures, fanRooms, onSelectRoom }) {
  return (
    <aside className="w-72 bg-gray-50 border-r p-4 hidden md:block">
      <section className="mb-6">
        <h3 className="font-semibold mb-3">Upcoming Fixtures</h3>
        <div className="space-y-2">
          {fixtures.map((f) => (
            <div key={f.id} className="p-2 rounded hover:bg-white cursor-pointer">
              <div className="text-sm font-medium">{f.home} vs {f.away}</div>
              <div className="text-xs text-gray-500">{formatDate(f.date)} — {f.competition}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-3">Fan Rooms</h3>
        <div className="space-y-2">
          {fanRooms.map((r) => (
            <button key={r.id} onClick={() => onSelectRoom(r.id)} className="w-full text-left p-2 rounded hover:bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.participants} online</div>
                </div>
                <div className="text-xs text-sky-600">Join</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

