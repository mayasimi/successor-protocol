"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    const success = await login(email, password);

    if (success) {
      toast.success("Welcome back!");
      router.push("/dashboard");
    } else {
      toast.error("Login failed");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bgDark p-4">
      <div className="w-full max-w-md rounded-2xl border border-borderColor bg-cardBg p-6 md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent">
            <span className="text-white text-sm">⌛</span>
          </div>
          <span className="bg-gradient-to-r from-white to-accent bg-clip-text text-2xl font-bold text-transparent">
            successor
          </span>
        </div>

        <h2 className="text-2xl font-semibold">Welcome back</h2>
        <p className="mb-6 text-sm text-gray-400">
          Sign in to your autonomous will
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs uppercase tracking-wide text-gray-400"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
            />
          </div>

          <Button
            onClick={handleEmailLogin}
            isLoading={isLoading}
            className="w-full"
          >
            Sign in →
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-borderColor" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-500">
              <span className="bg-cardBg px-2">or</span>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            No account?{" "}
            <a href="/signup" className="text-accent hover:underline">
              Create account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
