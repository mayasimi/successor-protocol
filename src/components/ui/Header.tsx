"use client";

import { WalletButton } from "@/components/wallet/WalletButton";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6">
      <div />
      <WalletButton />
    </header>
  );
}
