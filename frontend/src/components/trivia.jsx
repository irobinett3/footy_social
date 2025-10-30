// import React, { useEffect, useState } from "react";
// import TriviaPanel from "./trivia";

// export default function TriviaPage() {
//   const [trivia, setTrivia] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     // 👇 change the URL if your backend runs on port 8000
//     fetch("http://localhost:8000/api/trivia/daily")
//       .then((res) => {
//         console.log("Response status:", res.status);
//         return res.json();
//       })
//       .then((data) => {
//         console.log("Fetched trivia:", data);
//         setTrivia(data);
//       })
//       .catch((err) => console.error("Error fetching trivia:", err))
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return <div className="p-4">Loading trivia...</div>;

//   return (
//     <div className="p-4">
//       <TriviaPanel trivia={trivia} />
//     </div>
//   );
// }
import React, { useState } from "react";

export default function TriviaPanel({ trivia }) {
  const [selected, setSelected] = useState(null); // store which option was clicked
  const [isCorrect, setIsCorrect] = useState(null); // track correctness

  // Safely get first question
  const questionObj = trivia?.questions?.[0] || null;

  if (!trivia || !questionObj) {
    return <div className="p-4 text-gray-500">No trivia available today.</div>;
  }

  const handleClick = (option) => {
    setSelected(option);
    setIsCorrect(option === questionObj.answer); // compare with correct answer
  };

  return (
    <div className="bg-white rounded shadow-sm p-4 max-w-lg mx-auto">
      <h2 className="text-lg font-semibold mb-3">{trivia.title}</h2>

      <div className="p-3 border rounded">
        <div className="font-medium mb-2">{questionObj.q}</div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {questionObj.options.map((opt, idx) => (
            <button
              key={idx}
              className={`p-2 border rounded text-sm hover:bg-gray-100 
                ${
                  selected
                    ? opt === questionObj.answer
                      ? "bg-green-200"
                      : opt === selected
                      ? "bg-red-200"
                      : ""
                    : ""
                }`}
              onClick={() => handleClick(opt)}
              disabled={!!selected} // disable buttons after one click
            >
              {opt}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-3 font-medium">
            {isCorrect ? "✅ Correct!" : `❌ Wrong! Correct answer: ${questionObj.answer}`}
          </div>
        )}
      </div>
    </div>
  );
}
