"use client";

import { useParams } from "next/navigation";
import { useAuth } from "../../../AuthContext";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAutoResize } from "../../../../lib/useAutoResize";
import dynamic from "next/dynamic";
import io from "socket.io-client";
import { Pencil, Trash2, Reply } from 'lucide-react';
import React from "react";
// Highlight helper
function highlight(text: string, search: string) {
  if (!search) return text;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.split(regex).map((part, i) =>
    part.toLowerCase() === search.toLowerCase() ? <mark key={i}>{part}</mark> : part
  );
}

// Highlight @mentions helper
function highlightMentions(text: string, members: any[]): (string | React.ReactElement)[] | string {
  if (!text) return text;
  const usernames = (members || []).map((m: any) => m.username).filter(Boolean);
  if (usernames.length === 0) return text;
  // Build a regex for all usernames in the group
  const regex = new RegExp(`@(${usernames.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');
  let lastIndex = 0;
  let found = false;
  const result: (string | React.ReactElement)[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    found = true;
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    result.push(
      React.createElement('span', { key: match.index, className: "bg-yellow-200 text-yellow-900 font-semibold rounded px-1" }, match[0])
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return found ? result : text;
}

// Helper to flatten and render highlightMentions and highlight together
function renderContentWithMentionsAndSearch(content: string, search: string, members: any[]) {
  // First, highlight mentions in the raw string
  const withMentions = highlightMentions(content, members);
  // Then, if search is present, highlight search terms inside the result
  if (!search) return withMentions;
  // If withMentions is a string, just use highlight
  if (typeof withMentions === 'string') return highlight(withMentions, search);
  // If it's an array, map highlight over each string part
  return withMentions.map((part, i) =>
    typeof part === 'string' ? highlight(part, search) : part
  );
}

interface Message {
  _id: string;
  group: string;
  sender: string;
  content?: string;
  createdAt: string;
  fileUrl?: string;
  fileType?: string;
  edited?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  reactions?: { userId: string; emoji: string }[];
  replyTo?: Message;
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

// Utility to extract URLs from text
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

export default function GroupChatPage() {
  const params = useParams();
  const { token, user, isUserOnline } = useAuth();
  const router = useRouter();
  const groupId = params.groupId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const isAdmin = group && String(group.admin) === String(user?._id);
  const [file, setFile] = useState<File | null>(null);
  const backendUrl = "http://localhost:3001";
  const [searchTerm, setSearchTerm] = useState("");
  const { textareaRef, adjustHeight } = useAutoResize();
  const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });
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
  // Ref for the menu
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Add a state to cache link previews per message
  const [linkPreviews, setLinkPreviews] = useState<{ [msgId: string]: any }>({});
  const [messageSearch, setMessageSearch] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  type MentionDropdownPos = { top?: number; left?: number; bottom?: number };
  const [mentionDropdownPos, setMentionDropdownPos] = useState<MentionDropdownPos | null>(null);

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

  // Fetch group details
  // useEffect(() => {
  //   if (!token || !groupId) return;
  //   axios.get(`http://localhost:3001/groups/${groupId}`, {
  //     headers: { Authorization: `Bearer ${token}` },
  //   })
  //     .then(res => setGroup(res.data))
  //     .catch(() => setGroup(null));
  // }, [token, groupId]);


  const fetchGroup = async () => {
    if (!token || !groupId) return;
    try {
      const res = await axios.get(`http://localhost:3001/groups/${groupId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroup(res.data);
    } catch {
      setGroup(null);
    }
  };
  
  useEffect(() => {
    fetchGroup();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (!token || !groupId || !user) return;

    if (file) {
      const formData = new FormData();
      formData.append('groupId', groupId);
      formData.append('content', input || '');
      if (file) formData.append('file', file);
      if (replyTo?._id) formData.append('replyTo', replyTo._id);
      try {
        const res = await axios.post(
          `http://localhost:3001/chat/group/send`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );
        setMessages(prev => [...prev, res.data]);
        setInput('');
        setFile(null);
        setReplyTo(null);
        adjustHeight();
      } catch {
        // handle error
      }
    } else {
      // Text-only: use socket
      const messagePayload: any = {
        sender: user._id,
        groupId,
        content: input || ''
      };
      if (replyTo?._id) messagePayload.replyTo = replyTo._id;
      if (socketRef.current) {
        socketRef.current.emit('group-message', messagePayload);
      }
      setInput('');
      setFile(null);
      setReplyTo(null);
      adjustHeight();
    }
  };

  useEffect(() => {
    if (!token) {
      router.replace('/welcome');
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:3001/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setUsers(res.data))
      .catch(() => setUsers([]));
  }, [token]);

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

  // Filtered messages for search (must be after uniqueMessages is declared)
  const filteredMessages = messageSearch
    ? uniqueMessages.filter(msg =>
        (msg.content || '').toLowerCase().includes(messageSearch.toLowerCase())
      )
    : uniqueMessages;

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

  // --- SOCKET SETUP AND TYPING LISTENER ---
  useEffect(() => {
    if (!token || !user?._id) return;

    // Only initialize once
    if (!socketRef.current) {
      socketRef.current = io("http://localhost:3001", {
        query: { userId: user._id },
        auth: { token },
      });
      socketRef.current.emit("join-group", { userId: user._id, groupId });
    }

    // --- Real-time group messages ---
    const handleGroupMessage = (msg: any) => {
      setMessages((prev) => [...prev, msg]);
    };
    socketRef.current.on("group-message", handleGroupMessage);

    // --- Typing indicator ---
    const handleTyping = (data: { sender: string; groupId: string }) => {
      if (data.sender !== user._id) {
        setTypingUser(
          group?.members.find((m) => m._id === data.sender)?.username || "Someone"
        );
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 2000);
      }
    };
    socketRef.current.on("typing", handleTyping);

    return () => {
      socketRef.current.off("group-message", handleGroupMessage);
      socketRef.current.off("typing", handleTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [token, user?._id, groupId, group]);

  // Helper to check if user has reacted
  const hasReacted = (msg: Message) => (msg.reactions ?? []).some(r => r.userId === user?._id);

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
  }, [socketRef]);

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

  // Edit message handler
  const handleEdit = (msg: Message) => {
    setEditingMessageId(msg._id);
    setEditInput(msg.content || "");
  };

  const handleEditSave = async (msg: Message) => {
    try {
      const res = await axios.patch(
        `http://localhost:3001/chat/group/message/${msg._id}`,
        { groupId, content: editInput },
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
        `http://localhost:3001/chat/group/message/${msg._id}`,
        { data: { groupId }, headers: { Authorization: `Bearer ${token}` } }
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
    socketRef.current.on('group-message-edited', handleMessageEdited);
    socketRef.current.on('group-message-deleted', handleMessageDeleted);
    return () => {
      socketRef.current.off('group-message-edited', handleMessageEdited);
      socketRef.current.off('group-message-deleted', handleMessageDeleted);
    };
  }, [socketRef]);

  // Mention autocomplete logic
  function handleInputMention(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setInput(value);
    adjustHeight();
    // Find last @ and check if it's a mention
    const caret = e.target.selectionStart;
    const textUpToCaret = value.slice(0, caret);
    const match = /(^|\s)@(\w*)$/.exec(textUpToCaret);
    if (match) {
      setShowMentionDropdown(true);
      setMentionQuery(match[2]);
      // Position dropdown above textarea
      const rect = e.target.getBoundingClientRect();
      setMentionDropdownPos({
        left: rect.left + window.scrollX,
        bottom: window.innerHeight - rect.top - window.scrollY
      });
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
    // Emit typing event
    if (socketRef.current && user?._id) {
      socketRef.current.emit("typing", {
        sender: user._id,
        groupId,
        isGroup: true,
      });
    }
  }

  function insertMention(username: string) {
    if (!textareaInputRef.current) return;
    const el = textareaInputRef.current;
    const caret = el.selectionStart;
    const value = input;
    // Find last @
    const mentionMatch = /@([\w]*)$/.exec(value.slice(0, caret));
    if (!mentionMatch) return;
    const start = mentionMatch.index;
    const before = value.slice(0, start);
    const after = value.slice(caret);
    const mention = `@${username} `;
    const newValue = before + mention + after;
    setInput(newValue);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(before.length + mention.length, before.length + mention.length);
    }, 0);
  }

  return (
    <div className="flex flex-row w-full max-h-[80vh]">

      <div className="flex-1 flex flex-col">
        <div className="flex flex-col h-full max-h-[80vh]">
         
          <Card className="w-full flex flex-col h-screen rounded-none border-none py-0 pt-3">
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
    <Dialog>
      <DialogTrigger asChild>
        <h2 className="text-xl font-bold cursor-pointer hover:underline">
          {group ? group.name : "Group Chat"}
        </h2>
      </DialogTrigger>
      <DialogContent>
        {/* ...members dialog content... */}
        <DialogTitle>{group?.name ? `${group.name} Members` : "Group Members"}</DialogTitle>
                <Tabs defaultValue="members" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="members">Members</TabsTrigger>
                    {/* Add more tabs if needed */}
                  </TabsList>
                  <TabsContent value="members">
                    <Input
                      placeholder="Find members"
                      className="mb-2"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    <ul className="text-sm max-h-60 overflow-y-auto">
                      {group?.members
                        .filter((member: any) =>
                          member.username.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((member: any) => (
                          <li key={member._id} className="py-1 text-gray-600 border-b last:border-b-0 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              {/* Online/offline dot */}
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${isUserOnline(member._id) ? 'bg-green-500' : 'bg-gray-400'}`}
                                title={isUserOnline(member._id) ? 'Online' : 'Offline'}
                              />
                              {member.username}
                              {String(member._id) === String(user?._id) && (
                                <span className="text-xs text-gray-600 ml-1">You</span>
                              )}
                              {String(member._id) === String(group.admin) && (
                                <span className="text-xs text-gray-600 ml-1">(Admin)</span>
                              )}
                            </span>
                            {isAdmin && String(member._id) !== String(user?._id) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs text-gray-600 ml-2 border px-1 rounded"
                                onClick={async () => {
                                  try {
                                    await axios.delete(`http://localhost:3001/groups/${groupId}/members/${member._id}`, {
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    // Refresh group info
                                    // re-fetch group details here
                                    await fetchGroup();
                                  } catch (error: unknown) {
                                    alert('Failed to remove member');
                                  }
                                }}
                              >Remove</Button>
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
                              await fetchGroup();
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
                                  !group?.members.some((m: any) => String(m._id) === String(u._id))
                              )
                              .map((u) => (
                                <option key={u._id} value={u._id}>
                                  {u.username}
                                </option>
                              ))}
                          </select>
                          <Button
                            type="submit"
                            size="sm"
                            className="text-xs text-white bg-gray-900 px-2 py-1 rounded"
                            disabled={!selectedUserId}
                          >
                            Add
                          </Button>
                        </form>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
      </DialogContent>
    </Dialog>
  
  </div>
 
         
            {/* --- TYPING INDICATOR --- */}
            {isTyping && (
              <div className="animate-pulse text-gray-200 text-xs px-4 pb-1">
                {typingUser ? `${typingUser} is typing…` : "Someone is typing…"}
              </div>
            )}
            <CardContent className="flex-1 overflow-y-auto p-0 space-y-3 bg-background">
              {loading ? (
                <div>Loading messages...</div>
              ) : (
                messages.length === 0 ? (
                  <div className="text-gray-400">No messages yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {groupedMessages.map(([dateLabel, msgs]) => (
                      <React.Fragment key={dateLabel}>
                        <li className="sticky top-0 z-10 text-center text-xs text-gray-500 bg-background py-1">{dateLabel}</li>
                        {filteredMessages
                          .filter(msg => msgs.some(m => m._id === msg._id))
                          .map(msg => {
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
                                className={`flex px-4 ${isOwnMessage ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`relative group rounded-lg px-3 py-2 max-w-xs break-words ${
                                    isOwnMessage
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  <div className={`text-xs flex justify-between gap-2 text-gray-300"
                                    ${isOwnMessage ? "text-gray-700" : "text-gray-300"}`}>
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
                                  {!msg.deleted && msg.fileUrl && (
                                    msg.fileType && msg.fileType.startsWith('image/') ? (
                                      <img src={backendUrl + msg.fileUrl} alt="attachment" className="max-w-xs max-h-40 mt-2 rounded" />
                                    ) : (
                                      <a href={backendUrl + msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline mt-2 block">Download file</a>
                                    )
                                  )}
                                  {msg.replyTo && (
                                    <div className="flex flex-col gap-1mb-1 px-2 py-1 bg-gray-50 border-l-4 border-blue-200 rounded text-xs text-gray-600 max-w-xs truncate">
                                      <span className="font-semibold">{isSenderObject(msg.replyTo.sender) ? msg.replyTo.sender.username : 'User'}</span> {msg.replyTo.content || (msg.replyTo.fileType && msg.replyTo.fileType.startsWith('image/') ? '[Image]' : '[File]')}
                                    </div>
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
                                        {renderContentWithMentionsAndSearch(msg.content || '', messageSearch, group?.members || [])}
                                        {msg.edited && <span className="text-xs text-gray-400 ml-1">(edited)</span>}
                                      </>
                                    )}
                                  </span>
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
                                    <div ref={menuRef} className={`absolute z-50  top-8 bg-white border rounded shadow-md min-w-[140px] flex flex-col  ${isOwnMessage ? 'right-0' : 'left-0 mx-auto'}`}>
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
                                
                                </div>

                                {!isOwnMessage && (
                                  <span className="ml-2">
                                    
                                    {/* <button
                                      className="text-xs text-gray-400 hover:text-gray-700 p-1 rounded"
                                      title={hasReacted(msg) ? "You have already reacted" : "Add reaction"}
                                      onClick={() => !hasReacted(msg) && setShowReactionPickerFor(msg._id)}
                                      style={{ display: 'inline-flex', alignItems: 'center' }}
                                      type="button"
                                      disabled={hasReacted(msg)}
                                    >
                                      <span role="img" aria-label="Add reaction">😊</span>
                                    </button> */}
                                    {showReactionPickerFor === msg._id && !hasReacted(msg) && (
                                      <div className=" mt-2">
                                        <EmojiPicker
                                          onEmojiClick={(emojiData: any) => handleAddReaction(msg, emojiData.emoji)}
                                          height={350}
                                          width={300}
                                        />
                                      </div>
                                    )}
                                  </span>
                                )}
                                {/* {!isOwnMessage && (
                                  <span className="ml-2">
                                    
                                    <button
                                      className="text-xs text-gray-400 hover:text-gray-700 p-1 rounded"
                                      title={hasReacted(msg) ? "You have already reacted" : "Add reaction"}
                                      onClick={() => !hasReacted(msg) && setShowReactionPickerFor(msg._id)}
                                      style={{ display: 'inline-flex', alignItems: 'center' }}
                                      type="button"
                                      disabled={hasReacted(msg)}
                                    >
                                      <span role="img" aria-label="Add reaction">😊</span>
                                    </button>
                                    {showReactionPickerFor === msg._id && !hasReacted(msg) && (
                                      <div className=" mt-2">
                                        <EmojiPicker
                                          onEmojiClick={(emojiData: any) => handleAddReaction(msg, emojiData.emoji)}
                                          height={350}
                                          width={300}
                                        />
                                      </div>
                                    )}
                                  </span>
                                )} */}
                               
                              </li>
                            );
                          })}
                      </React.Fragment>
                    ))}
                  </ul>
                )
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <CardFooter className="p-2 border-t bg-muted">
              <form onSubmit={handleSend} className="flex mb-4 items-end gap-2 w-full" encType="multipart/form-data"
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
                  // onChange={e => {
                  //   setInput(e.target.value);
                  //   adjustHeight();
                  //   // Emit typing event
                  //   if (socketRef.current && user?._id) {
                  //     socketRef.current.emit("typing", {
                  //       sender: user._id,
                  //       groupId,
                  //       isGroup: true,
                  //     });
                  //   }
                  // }}
                  onChange={handleInputMention}
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
                {/* Mention dropdown */}
                {showMentionDropdown && group?.members && (
                  <div
                    className="fixed z-50 border rounded shadow-md mb-1 max-h-48 overflow-y-auto hover:text-gray-700 text-gray-700"
                    style={{ left: mentionDropdownPos?.left ?? 0, bottom: mentionDropdownPos?.bottom ?? 0, minWidth: 180 }}
                  >
                    {group.members
                      .filter((m: any) =>
                        mentionQuery === '' || m.username.toLowerCase().includes(mentionQuery.toLowerCase())
                      )
                      .map((m: any) => (
                        <div
                          key={m._id}
                          className="px-3 py-2 cursor-pointer hover:bg-blue-100"
                          onMouseDown={e => {
                            e.preventDefault();
                            insertMention(m.username);
                          }}
                        >
                          @{m.username}
                        </div>
                      ))}
                  </div>
                )}
                {!showEmojiPicker && (
                <Button
                  type="button"
                  className="h-[40px] px-2"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  tabIndex={-1}
                >
                  😀
                </Button>
                 )}
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