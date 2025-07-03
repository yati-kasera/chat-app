"use client";

import { useParams } from "next/navigation";
import { useAuth } from "../../../AuthContext";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";

interface Message {
  _id: string;
  group: string;
  sender: string;
  content: string;
  createdAt: string;
}

interface Group {
  _id: string;
  name: string;
  members: any[];
  admin: string;
}

// Add type guard for sender
function isSenderObject(sender: unknown): sender is { _id: string; username: string } {
  return (
    !!sender &&
    typeof sender === 'object' &&
    '_id' in sender &&
    'username' in sender
  );
}

export default function GroupChatPage() {
  const params = useParams();
  const { token, user } = useAuth();
  const groupId = params.groupId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<any[]>([]);
const [selectedUserId, setSelectedUserId] = useState("");
const isAdmin = group && String(group.admin) === String(user?._id);

  // Fetch group details
  useEffect(() => {
    if (!token || !groupId) return;
    axios.get(`http://localhost:3001/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setGroup(res.data))
      .catch(() => setGroup(null));
  }, [token, groupId]);

  // Fetch group messages
  useEffect(() => {
    if (!token || !groupId) return;
    setLoading(true);
    axios.get(`http://localhost:3001/chat/group/${groupId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setMessages(res.data))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [token, groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      const res = await axios.post(
        `http://localhost:3001/chat/group/send`,
        { groupId, content: input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => [...prev, res.data]);
      setInput("");
    } catch {
      // handle error
    }
  };


  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:3001/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setUsers(res.data))
      .catch(() => setUsers([]));
  }, [token]);

  return (
    <div className="flex flex-row w-full">

<div className="flex-1 flex flex-col">
<div className="flex flex-col h-full max-h-[80vh]">
      <h2 className="text-xl font-bold mb-4">
        {group ? group.name : "Group Chat"}
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
                    : group?.members.find((u: any) => u._id === msg.sender)?.username || "";
                return (
                  <li
                    key={msg._id}
                    className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`px-2 py-2 rounded-lg max-w-xs break-words ${
                        isOwnMessage ? "text-gray-900" : "text-blue-900"
                      }`}
                    >
<div className="text-xs flex justify-between gap-2 text-gray-700">
  <span>{senderName}</span>
  <span>
    {msg.createdAt
      ? new Date(msg.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : ""}
  </span>
</div>
                      <span className="block">{msg.content}</span>
                    
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
  </div>


  {/* Sidebar for group members */}
  {group && (
    <aside className="w-48 min-w-[150px] bg-gray-100 border rounded p-2 h-auto ml-4">
      <h3 className="font-bold text-black mb-2 text-sm">Group Members</h3>
      <ul className="text-sm">
        {group.members?.map((member: any) => (
          <li key={member._id} className="py-1 text-black border-b last:border-b-0 flex items-center justify-between">
            <span>
              {member.username}
              {String(member._id) === String(user?._id) && (
                <span className="text-xs text-blue-600 ml-1">(You)</span>
              )}
              {String(member._id) === String(group.admin) && (
                <span className="text-xs text-green-600 ml-1">(Admin)</span>
              )}
            </span>
            {isAdmin && String(member._id) !== String(user?._id) && (
              <button
                className="text-xs text-gray-600 ml-2 border px-1 rounded"
                onClick={async () => {
                  try {
                    await axios.delete(`http://localhost:3001/groups/${groupId}/members/${member._id}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    // Refresh group info
                    // re-fetch group details here
                  } catch (error: unknown) {
                    alert('Failed to remove member');
                  }
                }}
              >Remove</button>
            )}
          </li>
        ))}
      </ul>
      {/* Add member UI for admin */}
      {isAdmin && (
        <div className="mt-4">
          <h4 className="font-semibold text-xs mb-1">Add Member</h4>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedUserId) return;
              try {
                await axios.post(
                  `http://localhost:3001/groups/${groupId}/members`,
                  { userId: selectedUserId },
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                setSelectedUserId("");
                // re-fetch group details here
              } catch (error) {
                alert("Failed to add member");
              }
            }}
            className="flex flex-row gap-2 items-center"
          >
            <select
              className="border rounded px-2 py-1 text-sm"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Select user</option>
              {users
                .filter(
                  (u) =>
                    !group.members.some((m: any) => String(m._id) === String(u._id))
                )
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.username}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="text-xs text-white bg-gray-900 px-2 py-1 rounded"
              disabled={!selectedUserId}
            >
              Add
            </button>
          </form>
        </div>
      )}
    </aside>
  )}

    </div>


    
  );
} 