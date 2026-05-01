"use client";

import { useAccount } from "wagmi";

export default function SettingsPage() {
  const { address } = useAccount();

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #1E1E24",
    fontSize: "0.85rem",
    color: "#ccc",
  };

  const cardStyle: React.CSSProperties = {
    background: "#111115",
    border: "1px solid #1E1E24",
    borderRadius: "20px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
  };

  const inputStyle: React.CSSProperties = {
    background: "#1A1A20",
    border: "1px solid #1E1E24",
    borderRadius: "12px",
    padding: "0.5rem 0.8rem",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.85rem",
    outline: "none",
  };

  return (
    <div>
      {/* Profile */}
      <div style={cardStyle}>
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Profile on 0G Chain
        </h3>
        <div style={rowStyle}>
          Wallet Address
          <span style={{ marginLeft: "auto", color: "#D4AF37", fontSize: "0.8rem" }}>
            {address
              ? `${address.slice(0, 6)}...${address.slice(-4)}`
              : "0x71C...6d8F"}
          </span>
        </div>
        <div style={rowStyle}>
          Display Name
          <span style={{ marginLeft: "auto" }}>
            <input
              type="text"
              defaultValue="Alex Rivera"
              style={inputStyle}
            />
          </span>
        </div>
      </div>

      {/* Blockchain Config */}
      <div style={cardStyle}>
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Blockchain Configuration
        </h3>
        <div style={rowStyle}>
          Network
          <span style={{ marginLeft: "auto", color: "#7A8B5E" }}>
            0G Chain · Testnet
          </span>
        </div>
        <div style={rowStyle}>
          Contract Address
          <span
            style={{
              marginLeft: "auto",
              color: "#D4AF37",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            0x8f3a2b1c... 🔗
          </span>
        </div>
      </div>

      {/* Gas Preferences */}
      <div style={cardStyle}>
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Gas Preferences
        </h3>
        <div style={rowStyle}>
          Gas Speed
          <span style={{ marginLeft: "auto" }}>
            <select style={inputStyle}>
              <option>Standard</option>
              <option>Fast</option>
            </select>
          </span>
        </div>
      </div>
    </div>
  );
}
