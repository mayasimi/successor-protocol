"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { WalletButton } from "@/components/wallet/WalletButton";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: handle signup
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Create account</h1>
        <p className="text-muted text-sm">Start securing your digital legacy</p>
      </div>

      <WalletButton />

      <div className="flex items-center gap-3">
        <hr className="flex-1 border-border" />
        <span className="text-muted text-xs">or continue with email</span>
        <hr className="flex-1 border-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full">
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
