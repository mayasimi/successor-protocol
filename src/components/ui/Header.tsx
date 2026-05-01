"use client";

import { WalletButton } from "../wallet/WalletButton";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borderColor bg-cardBg/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-sm text-accent">0G Chain · Testnet</span>
      </div>
      <div className="flex items-center gap-4">
        {user && <span className="text-sm text-gray-400">{user.email}</span>}
        <WalletButton />
      </div>
    </header>
  );
}
