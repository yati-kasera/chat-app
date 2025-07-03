"use client"

import { useState } from "react";
import { useAuth } from "../AuthContext";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const { login } = useAuth();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginResult, setLoginResult] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginResult('');
    try {
      await login(loginData.email, loginData.password);
      setLoginResult('Login successful!');
      router.push('/');
    } 
    catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setLoginResult(err.response?.data?.message || 'Login failed');
      } else {
        setLoginResult('Login failed');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-2">
            <input type="email" placeholder="Email" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} required className="border p-1 rounded" />
            <input type="password" placeholder="Password" value={loginData.password} onChange={e => setLoginData({ ...loginData, password: e.target.value })} required className="border p-1 rounded" />
            <Button type="submit" className="bg-gray-800 text-white rounded p-2 mt-2">Login</Button>
            {loginResult && <div className="text-sm mt-1">{loginResult}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 