"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleWallet = async () => {
    if (isConnected) {
      disconnect();
    } else {
      try {
        await connect({ connector: injected() });
      } catch {
        alert("Install MetaMask to connect a wallet");
      }
    }
  };

  return (
    <header
      style={{
        background: "rgba(17,17,21,0.8)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid #1E1E24",
        padding: "1rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          background: "rgba(122,139,94,0.2)",
          padding: "0.4rem 1rem",
          borderRadius: "40px",
          fontSize: "0.7rem",
          color: "#D4AF37",
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <i
          className="fas fa-circle"
          style={{ fontSize: "0.6rem", color: "#7A8B5E" }}
        />
        0G Chain · Testnet
      </div>

      <button
        onClick={handleWallet}
        style={{
          background: "linear-gradient(135deg,#7A8B5E,#5A6B3E)",
          border: "none",
          padding: "0.6rem 1.2rem",
          borderRadius: "40px",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.8rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <i className="fas fa-wallet" />
        {isConnected && address
          ? `${address.slice(0, 6)}...${address.slice(-4)}`
          : "Connect Wallet"}
      </button>
    </header>
  );
}
