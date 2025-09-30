import React from "react";

export default function TriviaPanel({ trivia }) {
  if (!trivia) return null;
  return (
    <div className="bg-white rounded shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-3">
        Daily Trivia — {trivia.title}
      </h2>
      <div className="space-y-3">
        {trivia.questions.map((q, i) => (
          <div key={i} className="p-3 border rounded">
            <div className="font-medium">
              Q{i + 1}. {q.q}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {q.options.map((o, j) => (
                <button key={j} className="p-2 border rounded text-sm">
                  {o}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
