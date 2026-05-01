"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect: _disconnect } = useDisconnect();
  const [pendingReg] = useLocalStorage<{
    ownerEmail: string;
    passwordHash: string;
    ownerName: string;
    wallet: string;
    chain: string;
  } | null>("pending_registration", null);
  const [, setUser] = useLocalStorage<object | null>("successor_user", null);

  // Email login
  const handleEmailLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setIsLoading(true);

    // Check against stored user session first
    const userFromStorage = localStorage.getItem("successor_user");
    if (userFromStorage) {
      try {
        const user = JSON.parse(userFromStorage);
        if (user.email === email) {
          toast.success("Logged in");
          router.push("/dashboard");
          setIsLoading(false);
          return;
        }
      } catch {
        // ignore parse errors
      }
    }

    if (
      pendingReg &&
      pendingReg.ownerEmail === email &&
      btoa(password) === pendingReg.passwordHash
    ) {
      const userData = {
        email,
        authenticated: true,
        ownerName: pendingReg.ownerName,
        wallet: pendingReg.wallet,
        chain: pendingReg.chain,
      };
      setUser(userData);
      await login(email, password);
      toast.success("Logged in");
      router.push("/dashboard");
    } else {
      toast.error("Invalid credentials or account not found");
    }
    setIsLoading(false);
  };

  // Wallet login
  const handleWalletLogin = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("MetaMask not installed");
      return;
    }
    try {
      await connect({ connector: injected() });
      // Wait for wagmi state to settle
      setTimeout(() => {
        if (isConnected && address) {
          const userData = {
            wallet: address,
            authenticated: true,
            email: null,
            ownerName: "Web3 User",
          };
          setUser(userData);
          toast.success(`Connected: ${address.slice(0, 6)}...${address.slice(-4)}`);
          router.push("/dashboard");
        } else {
          toast.error("Connection failed");
        }
      }, 1000);
    } catch {
      toast.error("Connection failed");
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
              required
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
              required
            />
          </div>

          <Button
            onClick={handleEmailLogin}
            isLoading={isLoading}
            className="w-full"
          >
            Sign in →
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-borderColor" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-500">
              <span className="bg-cardBg px-2">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleWalletLogin}
            className="w-full"
          >
            🦊 Connect wallet
          </Button>

          <p className="mt-6 text-center text-xs text-gray-400">
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
