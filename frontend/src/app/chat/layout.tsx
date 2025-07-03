"use client";

import { ReactNode, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import axios from "axios";
import { useAuth } from "../../app/AuthContext";
import { Button } from "@/components/ui/button";

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
  const { token, user, logout } = useAuth();
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

  return (
    <div className="flex min-h-screen">
      <aside className="w-72 border-r bg-gray-50 p-4 flex flex-col gap-6">
        <Card className="mb-4 p-2">
          <div className="font-bold mb-2">Chats</div>
          {fetchError && <div className="text-sm text-red-600 mb-2">{fetchError}</div>}
          <ul className="flex flex-col gap-1">
            {users.map((chat) => (
              <li key={chat._id}>
                <Link href={`/chat/with/${chat._id}`} className="block px-2 py-1 rounded hover:bg-gray-200">
                  {chat.username}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="mb-4 p-2">
          <div className="font-bold mb-2">Create Group</div>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleCreateGroupWithSelectedUsers();
            }}
            className="flex flex-col gap-2"
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
            <Button type="submit" >
              Create Group
            </Button>
            {groupResult && <div className="text-sm mt-1">{groupResult}</div>}
          </form>
        </Card>
        <Card className="p-2">
          <div className="font-bold mb-2">Groups</div>
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
        <Button onClick={logout} className="mt-4">Logout</Button>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
} 