"use client";

import { ReactNode, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";
import axios from "axios";
import { useAuth } from "../../app/AuthContext";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Pencil} from 'lucide-react';

interface User {
  _id: string;
  username: string;
  email: string;
}

interface Group {
  _id: string;
  name: string;
  members: User[];
  admin: string;
}

export default function ChatLayout({ children }: { children: ReactNode }) {
  const { token, user, logout, isUserOnline } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [groupForm, setGroupForm] = useState<{ name: string; memberIds: string[] }>({ name: '', memberIds: [] });
  const [groupResult, setGroupResult] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;

    axios.get("http://localhost:3001/users", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setUsers(res.data.filter((u: User) => u.email !== user?.email)))
      .catch(err => setFetchError(err.response?.data?.message || "Failed to fetch users"));

    axios.get("http://localhost:3001/groups", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setGroups(res.data))
      .catch(err => setFetchError(err.response?.data?.message || "Failed to fetch groups"));
  }, [token, user]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroupWithSelectedUsers = async () => {
    setGroupResult('');
    try {
      const response = await axios.post(
        'http://localhost:3001/groups',
        { name: groupForm.name, memberIds: selectedUserIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setGroups(prev => [...prev, response.data]);
      setGroupForm({ name: '', memberIds: [] });
      setSelectedUserIds([]);
      setGroupResult('Group created successfully!');
    } catch {
      setGroupResult('Failed to create group');
    }
  };

  function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return (
      <button
        className="w-full mt-4 px-3 py-2 border rounded text-sm bg-white dark:bg-gray-800 dark:text-white"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? "🌙 Dark" : "☀️ Light"} Mode
      </button>
    );
  }
  

  return (
    <div className="flex h-full">
      <aside className="w-72 h-screen overflow-y-auto border-r bg-gray-800 p-4 flex flex-col gap-6">
         <Card className="p-2">
          <div className="flex justify-between items-center">
          <div className="font-bold mb-2">Groups</div>
            <Dialog>
          <DialogTrigger asChild>
            <Button className=" mb-2" variant="outline" >
              <Pencil size={16} />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-full">
            <DialogTitle>Create a New Group</DialogTitle>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleCreateGroupWithSelectedUsers();
              }}
              className="flex flex-col gap-2 mt-4"
            >
              <input
                type="text"
                placeholder="Group Name"
                value={groupForm.name}
                onChange={e => setGroupForm({ ...groupForm, name: e.target.value })}
                required
                className="border p-1 rounded"
              />
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto border rounded p-2">
                {users.map(u => (
                  <Button
                    type="button"
                    key={u._id}
                    onClick={() => toggleUserSelection(u._id)}
                    className={`flex items-center gap-2 p-1 rounded ${
                      selectedUserIds.includes(u._id)
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {u.username}
                    {selectedUserIds.includes(u._id) && (
                      <span className="ml-auto text-xs">✓</span>
                    )}
                  </Button>
                ))}
              </div>
              <Button type="submit">
                Create Group
              </Button>
              {groupResult && <div className="text-sm mt-1">{groupResult}</div>}
            </form>
          </DialogContent>
        </Dialog>
        </div>
          <ul className="flex flex-col gap-1">
            {groups.map((group) => (
              <li key={group._id}>
                <Link href={`/chat/group/${group._id}`} className="block px-2 py-1 rounded hover:bg-gray-200">
                  {group.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="mb-4 p-2">
          <div className="font-bold mb-2">Chats</div>
          {fetchError && <div className="text-sm text-red-600 mb-2">{fetchError}</div>}
          <ul className="flex flex-col gap-1">
            {users.map((chat) => (
              <li key={chat._id}>
                <Link href={`/chat/with/${chat._id}`} className="block px-2 py-1 rounded hover:bg-gray-200 flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${isUserOnline(chat._id) ? 'bg-green-500' : 'bg-gray-400'}`}
                    title={isUserOnline(chat._id) ? 'Online' : 'Offline'}
                  />
                  {chat.username}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
       
       
        <Button onClick={logout} className="mt-4">Logout</Button>
        <ThemeSwitcher />
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
} 