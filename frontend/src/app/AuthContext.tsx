"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

interface User {
  _id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  onlineUsers: string[];
  isUserOnline: (userId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const socketRef = React.useRef<any>(null);

  useEffect(() => {
    // Optionally, load token/user from localStorage
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken) setToken(savedToken);
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    const res = await axios.post('http://localhost:3001/auth/login', { email, password });
    setToken(res.data.access_token);
    // Optionally fetch user info after login
    const userRes = await axios.get('http://localhost:3001/users/me', {
      headers: { Authorization: `Bearer ${res.data.access_token}` },
    });
    setUser(userRes.data);
  };

  const register = async (username: string, email: string, password: string) => {
    await axios.post('http://localhost:3001/users/register', { username, email, password });
    // Optionally auto-login after register
    await login(email, password);
  };

  const logout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // --- User Presence Logic ---
  useEffect(() => {
    if (!token || !user?._id) return;
    // Fetch initial online users
    axios.get('http://localhost:3001/users/online', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setOnlineUsers(res.data))
      .catch(() => setOnlineUsers([]));

    // Setup socket connection if not already
    if (!socketRef.current) {
      socketRef.current = io('http://localhost:3001', {
        query: { userId: user._id },
        auth: { token },
      });
    }
    // Listen for presence events
    const socket = socketRef.current;
    const handleUserOnline = (userId: string) => {
      setOnlineUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
    };
    const handleUserOffline = (userId: string) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId));
    };
    socket.on('user-online', handleUserOnline);
    socket.on('user-offline', handleUserOffline);
    // Clean up
    return () => {
      socket.off('user-online', handleUserOnline);
      socket.off('user-offline', handleUserOffline);
    };
  }, [token, user?._id]);

  const isUserOnline = (userId: string) => onlineUsers.includes(userId);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, onlineUsers, isUserOnline }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 