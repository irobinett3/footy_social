import React, { useEffect, useRef, useState } from "react";

// Mock WebSocket hook (replace with real one later)
function useWebSocketMock(roomId) {
  const [messages, setMessages] = useState([]);
  const send = (msg) => {
    const message = {
      id: Date.now(),
      text: msg,
      author: "You",
      ts: new Date().toISOString(),
    };
    setMessages((m) => [...m, message]);
  };

  useEffect(() => {
    const t = setInterval(() => {
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + Math.random(),
          text: "This is a live fan message",
          author: "FanBot",
          ts: new Date().toISOString(),
        },
      ]);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  return { messages, send };
}

export default function ChatRoom({ roomId }) {
  const { messages, send } = useWebSocketMock(roomId);
  const [text, setText] = useState("");
  const listRef = useRef();

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-3" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className="mb-2">
            <div className="text-xs text-gray-500">
              {m.author} • {new Date(m.ts).toLocaleTimeString()}
            </div>
            <div className="p-2 bg-gray-100 rounded inline-block">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              send(text);
              setText("");
            }
          }}
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Send a message..."
          />
          <button className="px-4 py-2 bg-sky-600 text-white rounded">Send</button>
        </form>
      </div>
    </div>
  );
}

