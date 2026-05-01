"use client";

import { useAccount } from "wagmi";

export default function HeartbeatPage() {
  const { isConnected } = useAccount();

  const sendHeartbeat = () => {
    if (!isConnected) {
      alert("Connect wallet first");
      return;
    }
    alert("✅ Heartbeat sent! Transaction signed on 0G Chain");
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
        <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
          Heartbeat Monitor
        </h3>
        <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
          Your on-chain proof of life
        </p>
        <div style={{ textAlign: "center", margin: "1.5rem 0" }}>
          <i
            className="fas fa-heartbeat"
            style={{ fontSize: "3rem", color: "#7A8B5E" }}
          />
        </div>
        <div
          style={{
            textAlign: "center",
            color: "#888",
            fontSize: "0.85rem",
            marginBottom: "0.5rem",
          }}
        >
          Last ping: 2 hours ago
        </div>
        <div
          style={{
            textAlign: "center",
            color: "#D4AF37",
            fontSize: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          Next required: 6 days 22 hours
        </div>
        <button
          onClick={sendHeartbeat}
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
          <i className="fas fa-heartbeat" style={{ marginRight: "8px" }} />
          Send Heartbeat (0.0001 ZG)
        </button>
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
          Recent Heartbeats on 0G Chain
        </h3>
        {["Today, 10:23 AM", "Yesterday, 2:15 PM"].map((time) => (
          <div
            key={time}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid #1E1E24",
              fontSize: "0.85rem",
              color: "#ccc",
            }}
          >
            {time}
            <span style={{ marginLeft: "auto", color: "#7A8B5E" }}>
              ✓ Recorded
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
