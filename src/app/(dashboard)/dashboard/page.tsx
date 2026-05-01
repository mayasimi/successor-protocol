"use client";

import { useAccount } from "wagmi";

const statCards = [
  { icon: "fa-heartbeat", value: "2h ago", label: "Last Heartbeat" },
  { icon: "fa-clock", value: "6d 22h", label: "Until Trigger" },
  { icon: "fa-file-signature", value: "4", label: "Instructions" },
  { icon: "fa-database", value: "190 MB", label: "0G Storage" },
];

export default function DashboardPage() {
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
      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {statCards.map((s) => (
          <div
            key={s.label}
            style={{
              background: "#111115",
              border: "1px solid #1E1E24",
              borderRadius: "20px",
              padding: "1.25rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#7A8B5E";
              (e.currentTarget as HTMLElement).style.transform =
                "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#1E1E24";
              (e.currentTarget as HTMLElement).style.transform =
                "translateY(0)";
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                background: "rgba(122,139,94,0.15)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <i className={`fas ${s.icon}`} style={{ color: "#7A8B5E" }} />
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: "0.8rem", color: "#888", marginTop: "4px" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Heartbeat Card */}
      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <h3 style={{ fontWeight: 600 }}>On-Chain Heartbeat</h3>
          <span style={{ color: "#D4AF37", fontSize: "0.7rem", cursor: "pointer" }}>
            View on 0G Explorer
          </span>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.85rem",
              color: "#888",
              marginBottom: "8px",
            }}
          >
            <span>Time remaining</span>
            <span>6 days 22 hours</span>
          </div>
          <div
            style={{
              height: "4px",
              background: "#222",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "48%",
                background: "linear-gradient(90deg,#7A8B5E,#D4AF37)",
                borderRadius: "4px",
              }}
            />
          </div>
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
            fontSize: "0.9rem",
          }}
        >
          <i className="fas fa-heartbeat" style={{ marginRight: "8px" }} />
          Send Heartbeat (0.0001 ZG)
        </button>
      </div>

      {/* Active Instructions Card */}
      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <h3 style={{ fontWeight: 600 }}>Active Instructions</h3>
          <span style={{ color: "#D4AF37", fontSize: "0.7rem", cursor: "pointer" }}>
            Add Instruction
          </span>
        </div>
        {[
          { icon: "fa-coins", title: "Send 5000 USDC", sub: "To: 0x71C...6d8F" },
          {
            icon: "fa-envelope",
            title: "Notify Next of Kin",
            sub: "jamie@example.com",
          },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 0",
              borderBottom: "1px solid #1E1E24",
            }}
          >
            <i className={`fas ${item.icon}`} style={{ color: "#7A8B5E" }} />
            <div>
              <div style={{ fontSize: "0.9rem" }}>{item.title}</div>
              <div style={{ fontSize: "0.7rem", color: "#888" }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
