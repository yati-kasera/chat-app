"use client";

import { useParams } from "next/navigation";
import { useAuth } from "../../../AuthContext";
import { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAutoResize } from "../../../../lib/useAutoResize";
import React from "react";
import dynamic from "next/dynamic";
import io from "socket.io-client";
import { Pencil, Trash2 } from 'lucide-react';
import { Reply } from 'lucide-react';

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface Message {
  _id: string;
  sender: string;
  recipient: string;
  content?: string;
  createdAt: string;
  fileUrl?: string;
  fileType?: string;
  status?: string; // <-- add status
  edited?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  reactions?: { userId: string; emoji: string }[];
  replyTo?: Message;
}

interface User {
  _id: string;
  username: string;
  email: string;
}

// Highlight helper
function highlight(text: string, search: string) {
  if (!search) return text;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(regex).map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? <mark key={i}>{part}</mark> : part
  );
}

export default function ChatWithUserPage() {
  const params = useParams();
  const { token, user, isUserOnline } = useAuth();
  const userId = params.userId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipient, setRecipient] = useState<User | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const backendUrl = "http://localhost:3001";
  const { textareaRef, adjustHeight } = useAutoResize();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const socketRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [linkPreviews, setLinkPreviews] = useState<{ [msgId: string]: any }>({});
  const [messageSearch, setMessageSearch] = useState('');

  // Click outside to close menu
  useEffect(() => {
    if (!openMenuFor) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuFor(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuFor]);

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


  console.log('Frontend user._id:', user?._id);

  // Fetch messages
  useEffect(() => {
    if (!token || !userId) return;
    setLoading(true);
    axios.get(`http://localhost:3001/chat/messages?with=${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        setMessages(prev => {
          const map = new Map();
          prev.forEach(m => map.set(m._id, m));
          res.data.forEach((m: any) => map.set(m._id, m));
          return Array.from(map.values());
        });
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [token, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!user) return;

    if (file) {
      // Use HTTP POST for file upload
      const formData = new FormData();
      formData.append('sender', user._id);
      formData.append('recipient', userId);
      formData.append('content', input || '');
      formData.append('file', file);
      if (replyTo?._id) formData.append('replyTo', replyTo._id);

      try {
        const res = await axios.post(
          'http://localhost:3001/chat/send-file',
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        // Optionally emit socket event for real-time update
        if (socketRef.current) {
          socketRef.current.emit('private-message', res.data);
        }
        setMessages(prev => [...prev, res.data]);
      } catch (error) {
        // handle error (optional: show error to user)
      }
    } else {
      // Text-only: use socket
      const messagePayload: any = {
        sender: user._id,
        recipient: userId,
        content: input || ''
      };
      if (replyTo?._id) messagePayload.replyTo = replyTo._id;
      if (socketRef.current) {
        console.log('Emitting private-message', messagePayload);
        socketRef.current.emit('private-message', messagePayload);
      }
    }
    setInput('');
    setFile(null);
    setReplyTo(null);
    adjustHeight();
  };

  const handleEmojiClick = (emojiData: any) => {
    const emoji = emojiData.emoji;
    if (textareaInputRef.current) {
      const start = textareaInputRef.current.selectionStart;
      const end = textareaInputRef.current.selectionEnd;
      const newValue = input.slice(0, start) + emoji + input.slice(end);
      setInput(newValue);
      setTimeout(() => {
        textareaInputRef.current?.focus();
        textareaInputRef.current?.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setInput(input + emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
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

  // Group messages by day
  const groupedMessages = useMemo(() => {
    const groups: { [date: string]: Message[] } = {};
    messages.forEach(msg => {
      const date = new Date(msg.createdAt);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      let label = date.toLocaleDateString();
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        label = "Today";
      } else if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        label = "Yesterday";
      }
      if (!groups[label]) groups[label] = [];
      groups[label].push(msg);
    });
    // Keep order as in messages
    return Object.entries(groups);
  }, [messages]);

  // Deduplicate messages by _id before rendering
  const uniqueMessages = Array.from(
    new Map(messages.map(msg => [msg._id, msg])).values()
  );

  // Filtered messages for search
  const filteredMessages = messageSearch
    ? uniqueMessages.filter(msg =>
        (msg.content || '').toLowerCase().includes(messageSearch.toLowerCase())
      )
    : uniqueMessages;

  // --- SOCKET SETUP, TYPING, AND DELIVERY STATUS ---
  useEffect(() => {
    if (!token || !user?._id) return;

    // Only initialize once
    if (!socketRef.current) {
      socketRef.current = io("http://localhost:3001", {
        query: { userId: user._id },
        auth: { token },
      });
      socketRef.current.on('connect', () => {
        console.log('Socket connected:', socketRef.current.id);
      });
      socketRef.current.on('connect_error', (err: any) => {
        console.error('Socket connect error:', err);
      });
    }

    // --- Real-time private messages ---
    const handlePrivateMessage = (msg: any) => {
      console.log('Received private-message:', msg);
      setMessages((prev) => {
        // If already present, update status if needed
        const exists = prev.find(m => m._id === msg._id);
        if (exists) {
          return prev.map(m => m._id === msg._id ? { ...m, ...msg } : m);
        }
        return [...prev, msg];
      });
      // Emit delivered receipt if message is for me
      if (msg.recipient === user._id && msg.status !== 'delivered') {
        socketRef.current.emit('message-delivered', { messageId: msg._id, senderId: msg.sender });
      }
    };
    socketRef.current.on("private-message", handlePrivateMessage);

    // --- Delivery status listeners ---
    const handleDelivered = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, status: 'delivered' } : m));
    };
    socketRef.current.on('message-delivered', handleDelivered);

    const handleRead = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, status: 'read' } : m));
    };
    socketRef.current.on('message-read', handleRead);

    // --- Typing indicator ---
    const handleTyping = (data: { sender: string }) => {
      if (data.sender !== user._id) {
        setTypingUser(recipient?.username || "Someone");
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
      }
    };
    socketRef.current.on("typing", handleTyping);

    return () => {
      socketRef.current.off("private-message", handlePrivateMessage);
      socketRef.current.off("message-delivered", handleDelivered);
      socketRef.current.off("message-read", handleRead);
      socketRef.current.off("typing", handleTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [token, user?._id, recipient]);

  // Emit read receipts for unread messages when chat is open
  useEffect(() => {
    if (!socketRef.current || !user?._id) return;
    uniqueMessages.forEach(msg => {
      if (msg.recipient === user._id && msg.status !== 'read') {
        socketRef.current.emit('message-read', { messageId: msg._id, senderId: msg.sender });
      }
    });
  }, [uniqueMessages, user?._id]);

  // Edit message handler
  const handleEdit = (msg: Message) => {
    setEditingMessageId(msg._id);
    setEditInput(msg.content || "");
  };

  const handleEditSave = async (msg: Message) => {
    try {
      const res = await axios.patch(
        `http://localhost:3001/chat/message/${msg._id}`,
        { content: editInput },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => prev.map(m => m._id === msg._id ? res.data : m));
      setEditingMessageId(null);
      setEditInput("");
    } catch (err) {
      // handle error
    }
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditInput("");
  };

  // Delete message handler
  const handleDelete = async (msg: Message) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await axios.delete(
        `http://localhost:3001/chat/message/${msg._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, deleted: true, content: "", deletedAt: new Date().toISOString() } : m));
    } catch (err) {
      // handle error
    }
  };

  // Socket listeners for real-time edit/delete
  useEffect(() => {
    if (!socketRef.current) return;
    const handleMessageEdited = (msg: Message) => {
      setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
    };
    const handleMessageDeleted = (msg: Message) => {
      setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
    };
    socketRef.current.on('message-edited', handleMessageEdited);
    socketRef.current.on('message-deleted', handleMessageDeleted);
    return () => {
      socketRef.current.off('message-edited', handleMessageEdited);
      socketRef.current.off('message-deleted', handleMessageDeleted);
    };
  }, []);

  // Add reaction handler
  const handleAddReaction = async (msg: Message, emoji: string) => {
    setShowReactionPickerFor(null);
    try {
      const res = await axios.post(
        `http://localhost:3001/chat/message/${msg._id}/reaction`,
        { emoji },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => prev.map(m => m._id === msg._id ? res.data : m));
    } catch (err) {
      // handle error
    }
  };

  // Socket listener for real-time reactions
  useEffect(() => {
    if (!socketRef.current) return;
    const handleMessageReaction = (msg: Message) => {
      setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
    };
    socketRef.current.on('message-reaction', handleMessageReaction);
    return () => {
      socketRef.current.off('message-reaction', handleMessageReaction);
    };
  }, []);

  // Helper to check if user has reacted
  const hasReacted = (msg: Message) => (msg.reactions ?? []).some(r => r.userId === user?._id);

  // Utility to extract URLs from text
  function extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }

  return (
    <div className="flex flex-row w-full max-h-[80vh]">
      <div className="flex-1 flex flex-col">
        <div className="flex flex-col h-full max-h-[80vh]">
          <Card className=" flex flex-col h-screen rounded-none border-none py-0 pt-3">
            {/* Search input for messages */}
            <div className="px-4 py-2">
              <Input
                placeholder="Search messages..."
                value={messageSearch}
                onChange={e => setMessageSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center justify-between px-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {/* Presence dot */}
                {recipient && (
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${isUserOnline(recipient._id) ? 'bg-green-500' : 'bg-gray-400'}`}
                    title={isUserOnline(recipient._id) ? 'Online' : 'Offline'}
                  />
                )}
                {recipient ? recipient.username : "Chat"}
              </h2>
              {/* --- TYPING INDICATOR --- */}
              {isTyping && (
                <div className="animate-pulse text-gray-500 text-xs px-4 pb-1">
                  {typingUser ? `${typingUser} is typing…` : "Someone is typing…"}
                </div>
              )}
            </div>
            <CardContent className="flex-1 overflow-y-auto p-1 space-y-1 bg-background">
              {loading ? (
                <div>Loading messages...</div>
              ) : (
                messages.length === 0 ? (
                  <div className="text-gray-400">No messages yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {groupedMessages.map(([dateLabel, msgs]) => {
                      const filteredGroupMsgs = msgs.filter(m => filteredMessages.some(fm => fm._id === m._id));
                      if (filteredGroupMsgs.length === 0) return null;
                      return (
                        <React.Fragment key={dateLabel}>
                          <li className="sticky top-0 z-10 text-center text-xs text-gray-500 bg-background py-1 mt-0">{dateLabel}</li>
                          {filteredGroupMsgs.map(msg => {
                            console.log('Message:', msg);
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
                                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`relative group rounded-lg px-3 py-2 max-w-xs break-words ${
                                    isOwnMessage
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
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
                                  {msg.replyTo && (
                                    <div className="mb-1 px-2 py-1 bg-gray-50 border-l-4 border-blue-200 rounded text-xs text-gray-600 max-w-xs truncate">
                                      <span className="font-semibold">{isSenderObject(msg.replyTo.sender) ? msg.replyTo.sender.username : 'User'}</span> {msg.replyTo.content || (msg.replyTo.fileType && msg.replyTo.fileType.startsWith('image/') ? '[Image]' : '[File]')}
                                    </div>
                                  )}
                                  {!msg.deleted && msg.fileUrl && (
                                    msg.fileType && msg.fileType.startsWith('image/') ? (
                                      <img src={backendUrl + msg.fileUrl} alt="attachment" className="max-w-xs max-h-40 mt-2 rounded" />
                                    ) : (
                                      <a href={backendUrl + msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline mt-2 block">Download file</a>
                                    )
                                  )}
                                  <span className="block whitespace-pre-wrap">
                                    {msg.deleted ? (
                                      <span className="italic text-gray-400">This message was deleted</span>
                                    ) : editingMessageId === msg._id ? (
                                      <span>
                                        <textarea
                                          className="border rounded px-2 py-1 text-sm w-full"
                                          value={editInput}
                                          onChange={e => setEditInput(e.target.value)}
                                          rows={1}
                                          autoFocus
                                        />
                                        <div className="flex gap-2 mt-1">
                                          <Button size="sm" onClick={() => handleEditSave(msg)}>Save</Button>
                                          <Button size="sm" variant="outline" onClick={handleEditCancel}>Cancel</Button>
                                        </div>
                                      </span>
                                    ) : (
                                      <>
                                        {highlight(msg.content || '', messageSearch)}
                                        {(() => {
                                          const urls = extractUrls(msg.content || "");
                                          if (urls.length > 0 && !linkPreviews[msg._id]) {
                                            // Fetch preview if not already cached
                                            fetch(`http://localhost:3001/chat/link-preview?url=${encodeURIComponent(urls[0])}`)
                                              .then(res => res.json())
                                              .then(data => setLinkPreviews(prev => ({ ...prev, [msg._id]: data })))
                                              .catch(() => setLinkPreviews(prev => ({ ...prev, [msg._id]: { error: true } })));
                                          }
                                          const preview = linkPreviews[msg._id];
                                          if (preview && !preview.error) {
                                            return (
                                              <a href={preview.url || urls[0]} target="_blank" rel="noopener noreferrer" className="block border rounded p-2 mt-2 bg-gray-50 hover:bg-gray-100 transition">
                                                {preview.images && preview.images[0] && (
                                                  <img src={preview.images[0]} alt="" className="w-full max-h-32 object-cover rounded mb-2" />
                                                )}
                                                <div className="font-bold text-sm mb-1">{preview.title}</div>
                                                <div className="text-xs text-gray-600 mb-1">{preview.description}</div>
                                                <div className="text-xs text-blue-600 truncate">{preview.url || urls[0]}</div>
                                              </a>
                                            );
                                          }
                                          return null;
                                        })()}
                                        {msg.edited && <span className="text-xs text-gray-400 ml-1">(edited)</span>}
                                      </>
                                    )}
                                  </span>
                                  {/* 3-dot button, only on hover */}
                                  <button
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200"
                                    onClick={() => setOpenMenuFor(msg._id)}
                                    type="button"
                                    tabIndex={-1}
                                  >
                                    <span className="sr-only">More options</span>
                                    <svg width="20" height="20" fill="currentColor"><circle cx="4" cy="10" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="16" cy="10" r="2"/></svg>
                                  </button>
                                  {/* Dropdown menu */}
                                  {openMenuFor === msg._id && (
                                    <div ref={menuRef} className="absolute z-50 left-0 top-8 bg-white border rounded shadow-md min-w-[140px] max-w-[200px] flex flex-col right-0" style={{ wordBreak: 'break-word', overflow: 'auto', maxHeight: '15rem' }}>
                                      {/* Add Reaction */}
                                      <button
                                        className="px-4 py-2 text-left hover:bg-gray-100"
                                        onClick={() => {
                                          setShowReactionPickerFor(msg._id);
                                          setOpenMenuFor(null);
                                        }}
                                        disabled={hasReacted(msg)}
                                      >
                                        Add Reaction
                                      </button>
                                      {/* Reply */}
                                      {!msg.deleted && (
                                        <button
                                          className="px-4 py-2 text-left hover:bg-gray-100"
                                          onClick={() => {
                                            setReplyTo(msg);
                                            setOpenMenuFor(null);
                                          }}
                                        >
                                          Reply
                                        </button>
                                      )}
                                      {/* Edit (only for sender, not deleted, not file) */}
                                      {isOwnMessage && !msg.deleted &&  (
                                        <button
                                          className="px-4 py-2 text-left hover:bg-gray-100"
                                          onClick={() => {
                                            handleEdit(msg);
                                            setOpenMenuFor(null);
                                          }}
                                        >
                                          Edit
                                        </button>
                                      )}
                                      {/* Delete (only for sender, not deleted) */}
                                      {isOwnMessage && !msg.deleted && (
                                        <button
                                          className="px-4 py-2 text-left hover:bg-gray-100 text-red-600"
                                          onClick={() => {
                                            handleDelete(msg);
                                            setOpenMenuFor(null);
                                          }}
                                        >
                                          Delete
                                        </button>
                                      )}
                                      {/* Close menu */}
                                      <button
                                        className="px-4 py-2 text-left hover:bg-gray-100"
                                        onClick={() => setOpenMenuFor(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                                  {/* Reactions: horizontal flex at bottom of message box */}
                                  {(msg.reactions && msg.reactions.length > 0) && (
                                    <div className="flex  gap-1 mt-2">
                                      {Array.from(new Set((msg.reactions ?? []).map(r => r.emoji))).map(emoji => {
                                        const count = (msg.reactions ?? []).filter(r => r.emoji === emoji).length;
                                        const reactedByMe = (msg.reactions ?? []).some(r => r.emoji === emoji && r.userId === user?._id);
                                        return (
                                          <span
                                            key={emoji}
                                            className={`px-2 py-1 rounded-full text-xs cursor-pointer select-none border ${reactedByMe ? 'bg-blue-100 border-blue-400' : 'bg-gray-100 border-gray-300'}`}
                                            onClick={() => reactedByMe && handleAddReaction(msg, emoji)}
                                            title={reactedByMe ? 'Remove your reaction' : ''}
                                          >
                                            {emoji} {count > 1 ? count : ''}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                    {/* Delivery status indicator for own messages */}
              {isOwnMessage && (
                <span className="block text-right text-xs mt-1">
                  {msg.status === 'read' ? '✔✔' : msg.status === 'delivered' ? '✔✔' : '✔'}
                </span>
              )}
                                </div>
                              </li>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </ul>
                )
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <CardFooter className="p-2 border-t bg-muted">
              {replyTo && (
                <div className="flex items-center bg-gray-100 border-l-4 border-blue-400 px-2 py-1 mb-2 rounded">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">Replying to {isSenderObject(replyTo.sender) ? replyTo.sender.username : 'User'}:</div>
                    <div className="text-sm text-gray-700 truncate max-w-xs">
                      {replyTo.content || (replyTo.fileType && replyTo.fileType.startsWith('image/') ? '[Image]' : '[File]')}
                    </div>
                  </div>
                  <button className="ml-2 text-gray-400 hover:text-gray-700" onClick={() => setReplyTo(null)} title="Cancel reply">✕</button>
                </div>
              )}
              <form
                onSubmit={handleSend}
                className="flex items-end gap-2 w-full mb-4"
                encType="multipart/form-data"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: isDragActive ? "2px dashed #0070f3" : undefined,
                  background: isDragActive ? "#f0f8ff" : undefined,
                  borderRadius: 8,
                  transition: "background 0.2s, border 0.2s"
                }}
              >
                {isDragActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-100 bg-opacity-80 z-50 rounded">
                    <span className="text-blue-700 font-semibold">Drop file to upload</span>
                  </div>
                )}
                <label className="cursor-pointer flex items-center">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  />
                  <span className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
                    📎
                  </span>
                </label>
                {file && (
                  <div className="text-xs text-gray-600 mt-1">
                    Selected: {file.name}
                    <button type="button" onClick={() => setFile(null)} className="ml-2 text-red-500">✕</button>
                  </div>
                )}
                <textarea
                  ref={el => {
                    textareaRef.current = el;
                    textareaInputRef.current = el;
                  }}
                  className="flex-1 border rounded px-3 py-2 text-sm resize-none min-h-[40px] max-h-[120px]"
                  placeholder="Type a message or attach a file..."
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    adjustHeight();
                    // Emit typing event
                    if (socketRef.current && user?._id) {
                      socketRef.current.emit("typing", {
                        sender: user._id,
                        recipient: userId,
                      });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() || file) {
                        handleSend(e as any);
                      }
                    }
                  }}
                  rows={1}
                  style={{
                    minHeight: '40px',
                    maxHeight: '120px',
                    overflowY: 'auto'
                  }}
                />
                <Button
                  type="button"
                  className="h-[40px] px-2"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  tabIndex={-1}
                >
                  😀
                </Button>
                {showEmojiPicker && (
                  <div className="absolute bottom-14 right-2 z-50">
                    <EmojiPicker onEmojiClick={handleEmojiClick} height={350} width={300} />
                  </div>
                )}
                <Button type="submit" disabled={!input.trim() && !file} className="h-[40px]">Send</Button>
              </form>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
} 