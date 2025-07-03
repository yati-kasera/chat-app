"use client";

import { useParams } from "next/navigation";
import { useAuth } from "../../../AuthContext";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";

interface Message {
  _id: string;
  sender: string;
  recipient: string;
  content: string;
  createdAt: string;
}

interface User {
  _id: string;
  username: string;
  email: string;
}

export default function ChatWithUserPage() {
  const params = useParams();
  const { token, user } = useAuth();
  const userId = params.userId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipient, setRecipient] = useState<User | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch recipient user details
  useEffect(() => {
    if (!token || !userId) return;
    axios.get(`http://localhost:3001/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        const found = res.data.find((u: User) => u._id === userId);
        setRecipient(found || null);
      })
      .catch(() => setRecipient(null));
  }, [token, userId]);

  // Fetch messages
  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    axios.get(`http://localhost:3001/chat/messages?with=${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setMessages(res.data))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [token, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      const res = await axios.post(
        `http://localhost:3001/chat/send`,
        { recipient: userId, content: input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => [...prev, res.data]);
      setInput("");
    } catch {
      // handle error
    }
  };

  // Add type guard for sender
  function isSenderObject(sender: unknown): sender is { _id: string; username: string } {
    return (
      !!sender &&
      typeof sender === 'object' &&
      '_id' in sender &&
      'username' in sender
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <h2 className="text-xl font-bold mb-4">
        {recipient ? `Chat with ${recipient.username}` : "Chat"}
      </h2>
      <div className="flex-1 overflow-y-auto border rounded p-4 bg-gray-50 mb-2">
        {loading ? (
          <div>Loading messages...</div>
        ) : (
          messages.length === 0 ? (
            <div className="text-gray-400">No messages yet.</div>
          ) : (
            <ul className="space-y-2">
              {messages.map(msg => {
                const senderId = isSenderObject(msg.sender) ? msg.sender._id : msg.sender;
                const isOwnMessage = senderId === user?._id;
                const senderName = isOwnMessage
                  ? "You"
                  : isSenderObject(msg.sender)
                    ? msg.sender.username
                    : recipient?.username || "";
                return (
                  <li
                    key={msg._id}
                    className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`px-2 py-2 rounded-lg max-w-xs break-words ${
                        isOwnMessage ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      <span className="text-xs text-gray-700">
                        {senderName}
                      </span>
                      <span className="block">{msg.content}</span>
                      <span className="text-[10px] text-gray-400">
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 border rounded p-2"
          placeholder="Type a message..."
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
} 