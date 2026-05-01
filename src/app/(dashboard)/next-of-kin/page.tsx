"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

export default function NextOfKinPage() {
  const { isConnected } = useAccount();
  const [kinName, setKinName] = useState("");
  const [kinEmail, setKinEmail] = useState("");

  const handleDeploy = () => {
    if (!isConnected) {
      alert("Connect wallet first");
      return;
    }
    alert("📧 Invitation deployed to 0G Chain");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginBottom: "1rem",
    background: "#1A1A20",
    border: "1px solid #1E1E24",
    borderRadius: "12px",
    padding: "0.8rem",
    color: "#fff",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.9rem",
    outline: "none",
  };

  return (
    <div>
      {/* Current Next of Kin */}
      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Current Next of Kin
        </h3>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div
            style={{
              width: "50px",
              height: "50px",
              background: "linear-gradient(135deg,#7A8B5E,#D4AF37)",
              borderRadius: "50%",
              flexShrink: 0,
            }}
          />
          <div>
            <h4 style={{ fontWeight: 600 }}>Jamie Rivera</h4>
            <p style={{ color: "#888", fontSize: "0.85rem" }}>
              jamie@example.com
            </p>
            <span style={{ color: "#7A8B5E", fontSize: "0.8rem" }}>
              ✓ Confirmed on 0G Chain
            </span>
          </div>
        </div>
      </div>

      {/* Update Next of Kin */}
      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Update Next of Kin (On-Chain)
        </h3>
        <input
          type="text"
          placeholder="Full name"
          value={kinName}
          onChange={(e) => setKinName(e.target.value)}
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="Email"
          value={kinEmail}
          onChange={(e) => setKinEmail(e.target.value)}
          style={inputStyle}
        />
        <button
          onClick={handleDeploy}
          style={{
            width: "100%",
            background: "linear-gradient(135deg,#7A8B5E,#5A6B3E)",
            border: "none",
            padding: "12px",
            borderRadius: "40px",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <i className="fas fa-paper-plane" style={{ marginRight: "8px" }} />
          Deploy Invitation to 0G Chain
        </button>
      </div>
    </div>
  );
}
