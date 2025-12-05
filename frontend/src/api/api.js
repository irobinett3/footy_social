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

  fetchFixtures: async () => {
    // Pull fixtures directly from the database-backed API (CSV-fed epl_matches table)
    try {
      const res = await fetch(`${API_BASE_URL}/api/fixtures`);
      if (!res.ok) {
        return { live: [], upcoming: [] };
      }
      const data = await res.json();
      const normalizeList = (list, state) =>
        (Array.isArray(list) ? list : []).map((item) => ({
          ...item,
          state: item.state || state,
          competition: item.competition || "Premier League",
        }));
      return {
        live: normalizeList(data.live, "live"),
        upcoming: normalizeList(data.upcoming, "upcoming"),
      };
    } catch (err) {
      console.error("Failed to fetch fixtures from API:", err);
      return { live: [], upcoming: [] };
    }
  },

  fetchFanRooms: async () => {
    return makeRequest('/fanrooms');
  },

  fetchFanRoom: async (roomId) => {
    return makeRequest(`/fanrooms/${roomId}`);
  },

  fetchFanRoomMessages: async (roomId, chatDate) => {
    const query = chatDate ? `?chat_date=${encodeURIComponent(chatDate)}` : '';
    return makeRequest(`/fanrooms/${roomId}/messages${query}`);
  },

  fetchTriviaForDay: async () => ({
    id: "triv-20250924",
    title: "Guess the Top Scorer",
    questions: [{ q: "Who scored the most goals in 2024/25 PL?", options: ["A","B","C","D"] }]
  }),
};
