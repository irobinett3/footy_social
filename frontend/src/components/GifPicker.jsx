import React, { useState, useEffect, useRef } from "react";

// Using backend API to proxy GIF requests
const API_BASE_URL = "http://localhost:8000";

export default function GifPicker({ onSelectGif, isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Fetch trending GIFs on mount
  useEffect(() => {
    if (isOpen && trending.length === 0) {
      fetchTrendingGifs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchTrendingGifs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/gifs/trending?limit=20`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("GIF API response:", data);
      
      if (data.results && Array.isArray(data.results)) {
        setTrending(data.results);
        setGifs(data.results);
      } else {
        console.warn("Unexpected API response format:", data);
        setGifs([]);
      }
    } catch (error) {
      console.error("Error fetching trending GIFs:", error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query) => {
    if (!query.trim()) {
      setGifs(trending);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/gifs/search?q=${encodeURIComponent(query)}&limit=20`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("GIF search response:", data);
      
      if (data.results && Array.isArray(data.results)) {
        setGifs(data.results);
      } else {
        setGifs([]);
      }
    } catch (error) {
      console.error("Error searching GIFs:", error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchGifs(value);
    }, 500);
  };

  const handleGifSelect = (gif) => {
    // Tenor API structure
    const gifUrl = gif.media_formats?.gif?.url || gif.media_formats?.mediumgif?.url || gif.url;
    onSelectGif(gifUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Choose a GIF</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search GIFs..."
          className="w-full px-3 py-2 border rounded mb-4"
        />

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading GIFs...</div>
          ) : gifs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div>No GIFs found</div>
              <div className="text-xs mt-2 text-gray-400">
                Try searching for something else or check the console for errors
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleGifSelect(gif)}
                  className="relative aspect-square overflow-hidden rounded hover:opacity-80 transition-opacity"
                >
                  <img
                    src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url || gif.url}
                    alt={gif.content_description || "GIF"}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          Powered by Tenor
        </div>
      </div>
    </div>
  );
}

