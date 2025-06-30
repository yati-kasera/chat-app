"use client"

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import io, { type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";


export default function Home() {
  const { user, token, login, register, logout } = useAuth();
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerResult, setRegisterResult] = useState('');
  const [loginResult, setLoginResult] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [groupForm, setGroupForm] = useState({ name: '', memberIds: [] as string[] });
  const [groupResult, setGroupResult] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const router = useRouter();

  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  // useEffect(() => {
  //   if (token) {
  //     socketRef.current = io("http://localhost:3001", {
  //       auth: { token },
  //     });
  //     socketRef.current.on("message", (msg: any) => {
  //       setMessages((prev) => [...prev, msg]);
  //     });
  //     return () => {
  //       socketRef.current?.disconnect();
  //     };
  //   }
  // }, [token]);

  useEffect(() => {
    if (token) {
      // Fetch users
      axios.get('http://localhost:3001/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => setUsers(res.data.filter((u: any) => u.email !== user?.email)))
        .catch(err => setFetchError(err.response?.data?.message || 'Failed to fetch users'));

      // Fetch user's groups
      axios.get('http://localhost:3001/groups', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => setGroups(res.data))
        .catch(err => console.error('Failed to fetch groups:', err));
    }
  }, [token, user]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterResult('');
    try {
      await register(registerData.username, registerData.email, registerData.password);
      setRegisterResult('Registered!');
    } catch (err: any) {
      setRegisterResult(err.response?.data?.message || 'Registration failed');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginResult('');
    try {
      await login(loginData.email, loginData.password);
      setLoginResult('Login successful!');
    } catch (err: any) {
      setLoginResult(err.response?.data?.message || 'Login failed');
    }
  };

  const handleChatWith = (recipient: any) => {
    router.push(`/chatwith?recipientId=${recipient._id}&recipientName=${encodeURIComponent(recipient.username)}`);
  };

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
    } catch (err) {
        setGroupResult('Failed to create group');
    }
  };

  const handleJoinGroup = (groupId: string) => {
     router.push(`/chatwith?groupId=${groupId}&isGroup=true`);
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <div className="flex flex-col gap-8 w-full max-w-md">
          {!token && (
            <>
              <form onSubmit={handleRegister} className="flex flex-col gap-2 p-4 border rounded">
                <h2 className="font-bold">Register</h2>
                <input type="text" placeholder="Username" value={registerData.username} onChange={e => setRegisterData({ ...registerData, username: e.target.value })} required className="border p-1 rounded" />
                <input type="email" placeholder="Email" value={registerData.email} onChange={e => setRegisterData({ ...registerData, email: e.target.value })} required className="border p-1 rounded" />
                <input type="password" placeholder="Password" value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} required className="border p-1 rounded" />
                <button type="submit" className="bg-gray-800 text-white rounded p-2 mt-2">Register</button>
                {registerResult && <div className="text-sm mt-1">{registerResult}</div>}
              </form>
              <form onSubmit={handleLogin} className="flex flex-col gap-2 p-4 border rounded">
                <h2 className="font-bold">Login</h2>
                <input type="email" placeholder="Email" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} required className="border p-1 rounded" />
                <input type="password" placeholder="Password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} required className="border p-1 rounded" />
                <button type="submit" className="bg-gray-800 text-white rounded p-2 mt-2">Login</button>
                {loginResult && <div className="text-sm mt-1">{loginResult}</div>}
              </form>
            </>
          )}
          {token && (
            <>
              <div className="flex flex-col gap-2 p-4 border rounded">
                <h2 className="font-bold">All Users</h2>
                {fetchError && <div className="text-sm text-red-600">{fetchError}</div>}
                <ul className="divide-y divide-gray-200">
                  {users.map((u) => (
                    <li key={u._id} className="flex items-center gap-4 justify-between py-2">
                      <span>{u.username}</span>
                      <Button onClick={() => handleChatWith(u)} >Chat</Button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2 p-4 border rounded">
                <h2 className="font-bold">Create Group</h2>
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
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border rounded p-2">
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
              </div>

              <div className="flex flex-col gap-2 p-4 border rounded">
                <h2 className="font-bold">Your Groups</h2>
                <ul className="divide-y divide-gray-200">
                  {groups.map((group) => (
                    <li key={group._id} className="flex items-center gap-4 justify-between py-2">
                      <div>
                        <span className="font-medium">{group.name}</span>
                        <div className="text-sm text-gray-600">
                          {group.members?.length || 0} members
                        </div>
                      </div>
                      {/* <button onClick={() => handleJoinGroup(group._id)} className="bg-green-600 text-white rounded p-2">Join Chat</button> */}
                      <Button onClick={() => handleJoinGroup(group._id)} >Join Chat</Button>
                    </li>
                  ))}
                </ul>
              </div>

              <Button onClick={logout} >Logout</Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
