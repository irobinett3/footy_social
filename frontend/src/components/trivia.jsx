import React, { useEffect, useState } from "react";

export default function TriviaPanel() {
  const [trivia, setTrivia] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch directly from your endpoint
    //fetch("http://0.0.0.0:8000/api/trivia/daily")
    fetch("http://localhost:8000/api/trivia/daily")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Transform backend data into unified structure
        const options = shuffleArray([
          data.correct,
          data.wrong1,
          data.wrong2,
          data.wrong3,
        ]);
        setTrivia({
          question: data.question,
          options: options,
          answer: data.correct,
        });
      })
      .catch((err) => console.error("Error fetching trivia:", err))
      .finally(() => setLoading(false));
  }, []);

  // Helper to shuffle answer options
  const shuffleArray = (arr) => {
    return arr
      .map((a) => ({ sort: Math.random(), value: a }))
      .sort((a, b) => a.sort - b.sort)
      .map((a) => a.value);
  };

  if (loading) return <div className="p-4">Loading trivia...</div>;
  console.log(trivia)
  if (!trivia) {
    return <div className="p-4 text-gray-500">No trivia available today.</div>;
  }

  const handleClick = (option) => {
    setSelected(option);
    setIsCorrect(option === trivia.answer);
  };

  return (
    <div className="bg-white rounded shadow-sm p-4 max-w mx-auto">
      <h2 className="text-lg font-semibold mb-3">Daily Trivia</h2>

      <div className="p-3 border rounded">
        <div className="font-medium mb-2">{trivia.question}</div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {trivia.options.map((opt, idx) => (
            <button
              key={idx}
              className={`p-2 border rounded text-sm hover:bg-gray-100 
                ${
                  selected
                    ? opt === trivia.answer
                      ? "bg-green-200"
                      : opt === selected
                      ? "bg-red-200"
                      : ""
                    : ""
                }`}
              onClick={() => handleClick(opt)}
              disabled={!!selected}
            >
              {opt}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-3 font-medium">
            {isCorrect
              ? "✅ Correct!"
              : `❌ Wrong! Correct answer: ${trivia.answer}`}
          </div>
        )}
      </div>
    </div>
  );
}
