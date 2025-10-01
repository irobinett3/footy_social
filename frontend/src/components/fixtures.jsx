import React from "react";

const formatDate = (iso) => new Date(iso).toLocaleString();

export default function FixturesPanel({ fixtures }) {
  return (
    <div className="bg-white rounded shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-3">Fixtures</h2>
      <div className="grid gap-3">
        {fixtures.map((f) => (
          <div
            key={f.id}
            className="p-3 border rounded flex justify-between items-center"
          >
            <div>
              <div className="font-medium">
                {f.home} vs {f.away}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(f.date).toLocaleString(undefined, { hour: 'numeric', minute: 'numeric', year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
            <div className="text-sm text-slate-600">{f.competition}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
