"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import { useAuth } from "../AuthContext";
import { useSearchParams } from "next/navigation";
import { useAutoResize } from "../../lib/useAutoResize";

// Define proper types
interface Message {
  _id: string;
  sender: string;
  recipient?: string;
  group?: string;
  content: string;
  createdAt?: string; // <-- Add this
}

interface GroupInfo {
  _id: string;
  name: string;
  admin: string;
  members: Array<{
    _id: string;
    username: string;
  }>;
}

interface User {
  _id: string;
  username: string;
}

interface SocketMessage {
  sender: string;
  recipient?: string;
  group?: string;
  content: string;
}

interface Sender {
  _id: string;
  username: string;
}

export default function ChatWithPage() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const recipientId = searchParams.get("recipientId") || "";
  const recipientName = searchParams.get("recipientName") || "";
  const groupId = searchParams.get("groupId") || "";
  const isGroup = searchParams.get("isGroup") === "true";
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const socketRef = useRef<any>(null);
  const { textareaRef, adjustHeight } = useAutoResize();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const chatId = isGroup ? groupId : recipientId;

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

      socketRef.current.on("private-message", (msg: Message) => {
        if (!isGroup) {
          setMessages((prev: Message[]) => [...prev, msg]);
        }
      });

      socketRef.current.on("group-message", (msg: Message) => {
        if (isGroup && msg.group === groupId) {
          setMessages((prev: Message[]) => [...prev, msg]);
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
        .catch((error: Error) => console.error('Failed to fetch users:', error));
    }
  }, [token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!token || !user?._id) return;

    // Only initialize once
    if (!socketRef.current) {
      socketRef.current = io("http://localhost:3001", {
        query: { userId: user._id },
        auth: { token },
      });
      if (isGroup && groupId) {
        socketRef.current.emit("join-group", { userId: user._id, groupId });
      }
    }

    // Listen for typing events
    const handleTyping = (data: { sender: string; groupId?: string }) => {
      if (data.sender !== user._id) {
        if (isGroup) {
          setTypingUser(
            groupInfo?.members?.find((m: any) => m._id === data.sender)?.username || "Someone"
          );
        } else {
          setTypingUser(recipientName || "Someone");
        }
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
      }
    };

    socketRef.current.on("typing", handleTyping);

    return () => {
      socketRef.current.off("typing", handleTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [token, user?._id, isGroup, groupId, groupInfo, recipientName]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!socketRef.current || !user) return;

    try {
      if (isGroup) {
        socketRef.current.emit("group-message", {
          sender: user._id,
          groupId: groupId,
          content: message,
        } as SocketMessage);
      } else {
        socketRef.current.emit("private-message", {
          sender: user._id,
          recipient: recipientId,
          content: message,
        } as SocketMessage);
      }

      setMessage("");
      fetchMessages(); // Refresh chat
    } catch (error: unknown) {
      console.error("Send failed:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
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
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.error("Fetch failed:", error.response?.data?.message || "Fetch failed");
      } else {
        console.error("Fetch failed:", error);
      }
    }
  };

  const fetchGroupInfo = async () => {
    try {
      const res = await axios.get(`http://localhost:3001/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroupInfo(res.data);
    } catch (error: unknown) {
      console.error("Failed to fetch group info:", error);
    }
  };

  const isAdmin = isGroup && groupInfo && String(groupInfo.admin) === String(user?._id);

  function isSenderObject(sender: unknown): sender is Sender {
    return (
      !!sender &&
      typeof sender === 'object' &&
      '_id' in sender &&
      'username' in sender
    );
  }

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
            <aside className="w-48 min-w-[150px] bg-gray-100 border rounded p-2 h-auto">
              <h3 className="font-bold text-black mb-2 text-sm">Group Members</h3>
              <ul className="text-sm">
                {groupInfo.members?.map((member) => (
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
                          } catch (error: unknown) {
                            console.error('Failed to remove member:', error);
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
                        fetchGroupInfo();
                      } catch (error) {
                        console.error(error);
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
                            !groupInfo.members.some((m) => String(m._id) === String(u._id))
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

          {/* Main chat UI */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <h2 className="font-bold text-lg text-black">
                {isGroup
                  ? groupInfo?.name || "Group Chat"
                  : recipientName || "Private Chat"}
              </h2>
              {isGroup && groupInfo && (
                <span className="text-xs text-gray-500">
                  {groupInfo.members.length} members
                </span>
              )}
            </div>
            {/* --- TYPING INDICATOR --- */}
            {isTyping && (
              <div className="animate-pulse text-gray-500 text-xs mb-2">
                {typingUser ? `${typingUser} is typing…` : "Someone is typing…"}
              </div>
            )}
            {/* Message List */}
            <div
              className="flex-1 overflow-y-auto bg-white rounded border p-4 mb-2"
              style={{ minHeight: 300, maxHeight: 400 }}
            >
              {messages.length === 0 ? (
                <div className="text-gray-400 text-center">No messages yet.</div>
              ) : (
                <ul className="space-y-2">
                  {messages.map((msg) => {
                    let senderId = isSenderObject(msg.sender) ? msg.sender._id : msg.sender;
                    const isOwnMessage = senderId === user?._id;
                    return (
                      <li
                        key={msg._id}
                        className={`flex  flex-col ${isOwnMessage ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`px-2 py-2  rounded-lg max-w-xs break-words ${
                            isOwnMessage
                              ? "bg-blue-900 text-white"
                              : "bg-gray-200 text-gray-900"
                          }`}
                        >
                           <span className="text-xs text-gray-700">
                           {isOwnMessage
                              ? "You"
                              : isSenderObject(msg.sender)
                                ? msg.sender.username
                                : users.find((u) => u._id === msg.sender)?.username}
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
                   <div ref={messagesEndRef} />
                </ul>
              )}
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-end gap-2 mt-auto"
              autoComplete="off"
            >
              <textarea
                ref={textareaRef}
                className="flex-1 border rounded px-3 py-2 text-sm resize-none min-h-[40px] max-h-[120px]"
                placeholder="Type your message... (Press Shift+Enter for new line)"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  adjustHeight();
                  // Emit typing event
                  if (socketRef.current && user?._id) {
                    if (isGroup) {
                      socketRef.current.emit("typing", {
                        sender: user._id,
                        groupId,
                        isGroup: true,
                      });
                    } else {
                      socketRef.current.emit("typing", {
                        sender: user._id,
                        recipient: recipientId,
                      });
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (message.trim()) {
                      handleSendMessage(e as any);
                    }
                  }
                }}
                rows={1}
                style={{
                  minHeight: '40px',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}
                required
              />
              <button
                type="submit"
                className="bg-gray-800 text-white px-4 py-2 rounded text-sm h-[40px]"
                disabled={!message.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}