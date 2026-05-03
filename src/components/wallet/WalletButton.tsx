"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/lib/utils";

const CONNECTOR_ICONS: Record<string, string> = {
  injected:       "🦊",
  walletConnect:  "🔗",
  coinbaseWallet: "🔵",
};

const CONNECTOR_LABELS: Record<string, string> = {
  injected:       "Browser Wallet",
  walletConnect:  "WalletConnect",
  coinbaseWallet: "Coinbase Wallet",
};

export function WalletButton() {
  const { address, isConnected, isPending, error, connectorOptions, disconnect } =
    useWallet();

  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  // Already connected — show address + disconnect
  if (isConnected && address) {
    return (
      <Button
        variant="secondary"
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
      >
        {truncateAddress(address)}
      </Button>
    );
  }

  return (
    <div className="relative flex flex-col items-end gap-2" ref={pickerRef}>
      <Button
        onClick={() => setShowPicker((v) => !v)}
        aria-label="Connect wallet"
        disabled={isPending}
        isLoading={isPending}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </Button>

      {/* Connector picker dropdown */}
      {showPicker && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "#111115",
            border: "1px solid #1E1E24",
            borderRadius: "16px",
            padding: "8px",
            minWidth: "220px",
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <p
            style={{
              fontSize: "0.7rem",
              color: "#555",
              padding: "4px 8px 8px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Choose wallet
          </p>

          {connectorOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={async () => {
                setShowPicker(false);
                try {
                  await opt.connect();
                } catch {
                  // error is stored in hook state
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "none",
                background: "transparent",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.9rem",
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(122,139,94,0.15)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span style={{ fontSize: "1.2rem", width: "24px", textAlign: "center" }}>
                {opt.icon
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={opt.icon} alt="" width={20} height={20} style={{ borderRadius: "4px" }} />
                  : CONNECTOR_ICONS[opt.id] ?? "💼"}
              </span>
              <span>{CONNECTOR_LABELS[opt.id] ?? opt.name}</span>
            </button>
          ))}

          {/* Install MetaMask hint when no injected wallet */}
          {!connectorOptions.some((o) => o.id === "injected") && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                color: "#888",
                fontSize: "0.85rem",
                textDecoration: "none",
              }}
            >
              <span style={{ width: "24px", textAlign: "center" }}>🦊</span>
              <span>Install MetaMask →</span>
            </a>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="max-w-64 text-right text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
