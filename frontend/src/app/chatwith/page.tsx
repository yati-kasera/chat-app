"use client"

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import { useAuth } from "../AuthContext";
import { useSearchParams } from "next/navigation";


export default function ChatWith() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const recipientId = searchParams.get("recipientId") || "";
  const recipientName = searchParams.get("recipientName") || "";
  const groupId = searchParams.get("groupId") || "";
  const isGroup = searchParams.get("isGroup") === "true";
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [chatError, setChatError] = useState("");
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  const chatId = isGroup ? groupId : recipientId;
  const chatName = isGroup ? groupInfo?.name : recipientName;

  useEffect(() => {
    if (token && user?._id) {
      socketRef.current = io("http://localhost:3001", {
        query: { userId: user._id },
        auth: { token },
      });

      // Join group room if it's a group chat
      if (isGroup && groupId) {
        socketRef.current.emit("join-group", {
          userId: user._id,
          groupId: groupId,
        });
      }

      socketRef.current.on("private-message", (msg: any) => {
        if (!isGroup) {
          setMessages((prev: any[]) => [...prev, msg]);
        }
      });

      socketRef.current.on("group-message", (msg: any) => {
        if (isGroup && msg.group === groupId) {
          setMessages((prev: any[]) => [...prev, msg]);
        }
      });

      return () => {
        if (isGroup && groupId) {
          socketRef.current?.emit("leave-group", {
            userId: user._id,
            groupId: groupId,
          });
        }
        socketRef.current?.disconnect();
      };
    }
  }, [token, user?._id, isGroup, groupId]);

  useEffect(() => {
    if (token && chatId) {
      fetchMessages();
      if (isGroup) {
        fetchGroupInfo();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, chatId, isGroup]);

  useEffect(() => {
    if (token) {
      axios.get('http://localhost:3001/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => setUsers(res.data))
        .catch(err => console.error('Failed to fetch users:', err));
    }
  }, [token]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setChatError("");

    if (!socketRef.current || !user) return;

    try {
      if (isGroup) {
        socketRef.current.emit("group-message", {
          sender: user._id,
          groupId: groupId,
          content: message,
        });
      } else {
        socketRef.current.emit("private-message", {
          sender: user._id,
          recipient: recipientId,
          content: message,
        });
      }

      setMessage("");
      fetchMessages(); // Refresh chat
    } catch (err: any) {
      setChatError("Send failed");
    }
  };

  const fetchMessages = async () => {
    setChatError("");
    try {
      let res;
      if (isGroup) {
        res = await axios.get(`http://localhost:3001/chat/group/${groupId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        res = await axios.get("http://localhost:3001/chat/messages", {
          params: { with: recipientId },
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setMessages(res.data);
    } catch (err: any) {
      setChatError(err.response?.data?.message || "Fetch failed");
    }
  };

  const fetchGroupInfo = async () => {
    try {
      const res = await axios.get(`http://localhost:3001/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
        setGroupInfo(res.data);
    } catch (err: any) {
      console.error("Failed to fetch group info:", err);
    }
  };

  const isAdmin = isGroup && groupInfo && String(groupInfo.admin) === String(user?._id);
  const usersNotInGroup = isAdmin && groupInfo && users
    ? users.filter(u => !groupInfo.members.some((m: any) => String(m._id) === String(u._id)))
    : [];

  if (!token) {
    return <div className="p-8">Please login to chat.</div>;
  }
  if (!chatId) {
    return <div className="p-8">No chat selected.</div>;
  }

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="flex flex-row w-full max-w-3xl gap-4">
          {/* Sidebar for group members */}
          {isGroup && groupInfo && (
            <aside className="w-48 min-w-[150px] bg-gray-100 border rounded p-2 h-84">
              <h3 className="font-bold text-black mb-2 text-sm">Group Members</h3>
              <ul className="text-sm">
                {groupInfo.members?.map((member: any) => (
                  <li key={member._id} className="py-1 text-black border-b last:border-b-0 flex items-center justify-between">
                    <span>
                      {member.username}
                      {String(member._id) === String(user?._id) && (
                        <span className="text-xs text-blue-600 ml-1">(You)</span>
                      )}
                      {String(member._id) === String(groupInfo.admin) && (
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
                            fetchGroupInfo();
                          } catch (err) {
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
                  <ul>
                    {usersNotInGroup.map((u: any) => (
                      <li key={u._id} className="flex items-center justify-between mb-1">
                        <span className="text-sm">{u.username}</span>
                        <button
                          className="text-xs text-gray-600 border px-1 rounded"
                          onClick={async () => {
                            try {
                              await axios.post(`http://localhost:3001/groups/${groupId}/members`, { userId: u._id }, {
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              fetchGroupInfo();
                            } catch (err) {
                              alert('Failed to add member');
                            }
                          }}
                        >Add</button>
                      </li>
                    ))}
                    {usersNotInGroup.length === 0 && <li className="text-xs text-gray-500">No users to add</li>}
                  </ul>
                </div>
              )}
            </aside>
          )}

          {/* Main chat area */}
          <div className="flex-1">
            <div className="flex flex-col gap-2 p-4 border rounded">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{chatName || chatId}</h2>
                {isGroup && groupInfo && (
                  <span className="text-sm text-gray-600">
                    {groupInfo.members?.length || 0} members
                  </span>
                )}
              </div>
              <div className="h-54 overflow-y-auto border p-2 bg-gray-900 mb-2">
                {messages.map((msg, i) => {
                  const isSender = String(msg.sender?._id || msg.sender) === String(user?._id);
                  return (
                    <div
                      key={i}
                      className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-1`}
                    >
                      <div
                        className={`inline-block px-2 py-1 rounded text-sm max-w-[70%] break-words ${isSender ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-900'}`}
                      >
                        {isGroup && !isSender && (
                          <span className="text-xs text-gray-500 block mb-0.5">
                            {msg.sender?.username || 'Unknown'}
                          </span>
                        )}
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
              </div>
              <form onSubmit={sendMessage} className="flex gap-2">
                <input type="text" placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} className="border p-1 rounded flex-1" />
                <button type="submit" className="bg-gray-600 text-white rounded p-2">Send</button>
              </form>
              {chatError && <div className="text-sm mt-1 text-gray-600">{chatError}</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
