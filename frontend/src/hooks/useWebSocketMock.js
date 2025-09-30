import { useState, useEffect } from "react";

export function useWebSocketMock(roomId) {
  const [messages, setMessages] = useState([]);

  const send = (msg) => {
    const message = { id: Date.now(), text: msg, author: "You", ts: new Date().toISOString() };
    setMessages((m) => [...m, message]);
  };

  useEffect(() => {
    const t = setInterval(() => {
      setMessages((m) => [
        ...m,
        { id: Date.now() + Math.random(), text: "This is a live fan message", author: "FanBot", ts: new Date().toISOString() }
      ]);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return { messages, send };
}
