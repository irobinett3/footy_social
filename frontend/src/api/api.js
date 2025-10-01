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
    
    register: async (username, email, password, bio = '') => {
      return makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, bio }),
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

  // Mock data endpoints (replace with real ones later)
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
