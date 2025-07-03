"use client"

import { useState } from "react";
import { useAuth } from "../AuthContext";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  const { register } = useAuth();
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '' });
  const [registerResult, setRegisterResult] = useState('');
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterResult('');
    try {
      await register(registerData.username, registerData.email, registerData.password);
      setRegisterResult('Registered!');
      router.push('/login');
    }
    catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setRegisterResult(err.response?.data?.message || 'Registration failed');
      } else {
        setRegisterResult('Registration failed');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="flex flex-col gap-2">
            <input type="text" placeholder="Username" value={registerData.username} onChange={e => setRegisterData({ ...registerData, username: e.target.value })} required className="border p-1 rounded" />
            <input type="email" placeholder="Email" value={registerData.email} onChange={e => setRegisterData({ ...registerData, email: e.target.value })} required className="border p-1 rounded" />
            <input type="password" placeholder="Password" value={registerData.password} onChange={e => setRegisterData({ ...registerData, password: e.target.value })} required className="border p-1 rounded" />
            <Button type="submit" className="bg-gray-800 text-white rounded p-2 mt-2">Register</Button>
            {registerResult && <div className="text-sm mt-1">{registerResult}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 