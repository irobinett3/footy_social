// Mock API calls (replace with real ones later)
export const api = {
  fetchUpcomingFixtures: async () => [
    { id: 1, home: "Leeds United", away: "Arsenal", date: "2025-09-24T15:00:00Z", competition: "Premier League" },
    { id: 2, home: "Chelsea", away: "Liverpool", date: "2025-09-24T17:30:00Z", competition: "Premier League" },
  ],

  fetchFanRooms: async () => [
    { id: "room-arsenal", name: "Arsenal Fans", team: "Arsenal", participants: 124 },
    { id: "room-leeds", name: "Leeds Fans", team: "Leeds United", participants: 44 },
  ],

  fetchTriviaForDay: async () => ({
    id: "triv-20250924",
    title: "Guess the Top Scorer",
    questions: [{ q: "Who scored the most goals in 2024/25 PL?", options: ["A","B","C","D"] }]
  }),
};
