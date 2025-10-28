// API configuration
const API_BASE_URL = 'http://localhost:8000';

// Helper function to get auth headers
const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` })
});

// Helper function to make authenticated requests
const makeRequest = async (url, options = {}, token = null) => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      ...getAuthHeaders(token),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(errorData.detail || 'Request failed');
  }

  return response.json();
};

export const api = {
  // Authentication endpoints
  auth: {
    login: async (username, password) => {
      return makeRequest('/auth/login-json', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    
    register: async (first_name, last_name, username, email, password, bio = '', favorite_team = '') => {
      return makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ first_name, last_name, username, email, password, bio, favorite_team }),
      });
    },
    
    getCurrentUser: async (token) => {
      return makeRequest('/auth/me', {}, token);
    },
  },

  // User endpoints
  users: {
    getProfile: async (token) => {
      return makeRequest('/users/me', {}, token);
    },
    
    updateProfile: async (userData, token) => {
      return makeRequest('/users/me', {
        method: 'PUT',
        body: JSON.stringify(userData),
      }, token);
    },
    
    deleteAccount: async (token) => {
      return makeRequest('/users/me', {
        method: 'DELETE',
      }, token);
    },
  },

  // Live data from ESPN: English Premier League scoreboard
  fetchUpcomingFixtures: async () => {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard';
    const res = await fetch(url);
    if (!res.ok) {
      // Fallback to empty list on error
      return [];
    }
    const data = await res.json();
    // Map events to the UI format and keep only scheduled/upcoming
    const events = Array.isArray(data.events) ? data.events : [];
    const fixtures = events
      .map((ev) => {
        const comp = (ev.competitions && ev.competitions[0]) || {};
        const teams = (comp.competitors || []).sort((a, b) => (a.homeAway === 'home' ? -1 : 1));
        const home = teams.find((t) => t.homeAway === 'home');
        const away = teams.find((t) => t.homeAway === 'away');
        const status = (comp.status && comp.status.type && comp.status.type.state) || 'pre';
        return {
          id: ev.id,
          home: home && home.team ? home.team.displayName : 'Home',
          away: away && away.team ? away.team.displayName : 'Away',
          date: ev.date,
          competition: (data.leagues && data.leagues[0] && data.leagues[0].name) || 'Premier League',
          state: status,
        };
      })
      .filter((f) => f.state === 'pre')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return fixtures;
  },

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
