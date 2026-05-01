"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

const instructions = [
  "Send 5000 USDC → 0x71C...6d8F",
  "Notify Next of Kin → jamie@example.com",
  "Cancel Subscriptions (Netflix, Spotify, AWS)",
];

export default function MyWillPage() {
  const { isConnected } = useAccount();
  const [newInstruction, setNewInstruction] = useState("");

  const handleUpload = () => {
    if (!isConnected) {
      alert("Connect wallet first");
      return;
    }
    if (!newInstruction.trim()) {
      alert("Please enter an instruction");
      return;
    }
    alert("📦 Instruction stored to 0G Storage");
    setNewInstruction("");
  };

  return (
    <div>
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
          Active Instructions (0G Attested)
        </h3>
        {instructions.map((inst) => (
          <div
            key={inst}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid #1E1E24",
              fontSize: "0.85rem",
              color: "#ccc",
            }}
          >
            {inst}
            <span style={{ marginLeft: "auto" }}>📦</span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Add New Instruction to 0G Storage
        </h3>
        <textarea
          rows={3}
          placeholder="Example: Send 1000 USDC to 0x..."
          value={newInstruction}
          onChange={(e) => setNewInstruction(e.target.value)}
          style={{
            width: "100%",
            background: "#1A1A20",
            border: "1px solid #1E1E24",
            borderRadius: "12px",
            padding: "0.8rem",
            color: "#fff",
            resize: "vertical",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.9rem",
          }}
        />
        <button
          onClick={handleUpload}
          style={{
            width: "100%",
            marginTop: "1rem",
            background: "linear-gradient(135deg,#7A8B5E,#5A6B3E)",
            border: "none",
            padding: "12px",
            borderRadius: "40px",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <i className="fas fa-upload" style={{ marginRight: "8px" }} />
          Upload to 0G Storage
        </button>
      </div>
    </div>
  );
}
