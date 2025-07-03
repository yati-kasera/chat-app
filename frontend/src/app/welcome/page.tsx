"use client"

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Welcome() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <h1 className="text-3xl font-bold mb-8">Welcome to the Chat App!</h1>
      <div className="flex gap-6">
        <Button onClick={() => router.push('/login')} className="px-8 py-3 text-lg">Login</Button>
        <Button onClick={() => router.push('/register')} className="px-8 py-3 text-lg">Register</Button>
      </div>
    </div>
  );
} 