"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { usePing, useSuccessorStatus, useLastPing } from "@/hooks/useSuccessor";
import { contractStateLabel } from "@/lib/contracts";

function formatRelativeTime(date: Date | null): string {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const { status, isLoading: statusLoading, refetch } = useSuccessorStatus();
  const { lastPingDate } = useLastPing();
  const { ping, isPending, isSuccess, error, isContractConfigured } = usePing();

  useEffect(() => {
    if (isSuccess) {
      toast.success("Heartbeat sent on-chain ✓");
      refetch();
    }
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (error) {
      const msg = (error as Error).message ?? "";
      toast.error(
        msg.includes("NotOwner")
          ? "Only the contract owner can send a heartbeat"
          : "Heartbeat failed"
      );
    }
  }, [error]);

  const handleHeartbeat = () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!isContractConfigured) {
      toast.info("Contract not deployed — running in demo mode");
      return;
    }
    ping();
  };

  const statCards = [
    {
      icon: "fa-heartbeat",
      value: statusLoading ? "…" : formatRelativeTime(lastPingDate),
      label: "Last Heartbeat",
    },
    {
      icon: "fa-clock",
      value: statusLoading
        ? "…"
        : status?.isTriggered
        ? "Triggered"
        : status?.timeRemainingLabel ?? "—",
      label: "Until Trigger",
    },
    {
      icon: "fa-file-signature",
      value: statusLoading
        ? "…"
        : status
        ? String(status.totalInstructions)
        : "—",
      label: "Instructions",
    },
    {
      icon: "fa-shield-alt",
      value: statusLoading
        ? "…"
        : status
        ? contractStateLabel(status.currentState)
        : "—",
      label: "Contract State",
    },
  ];

  const statusColor = status?.isTriggered
    ? "#ef4444"
    : status?.isExecuting || status?.isCompleted
    ? "#D4AF37"
    : "#7A8B5E";

  const progressPct = status
    ? status.triggered
      ? 0
      : 48
    : 48;

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
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#1E1E24";
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
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
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{s.value}</div>
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
          border: `1px solid ${statusColor}40`,
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
          {!isContractConfigured && (
            <span style={{ color: "#D4AF37", fontSize: "0.7rem" }}>
              Demo mode
            </span>
          )}
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
            <span style={{ color: statusColor }}>
              {statusLoading
                ? "Loading…"
                : status?.isTriggered
                ? "⚠️ Triggered"
                : status?.timeRemainingLabel ?? "—"}
            </span>
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
                width: `${progressPct}%`,
                background: `linear-gradient(90deg,${statusColor},#D4AF37)`,
                borderRadius: "4px",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>

        <button
          onClick={handleHeartbeat}
          disabled={isPending || status?.isTriggered || status?.isCompleted}
          style={{
            width: "100%",
            background:
              isPending || status?.isTriggered
                ? "#333"
                : "linear-gradient(135deg,#7A8B5E,#5A6B3E)",
            border: "none",
            padding: "12px",
            borderRadius: "40px",
            color: "#fff",
            fontWeight: 600,
            cursor:
              isPending || status?.isTriggered || status?.isCompleted
                ? "not-allowed"
                : "pointer",
            fontSize: "0.9rem",
          }}
        >
          <i className="fas fa-heartbeat" style={{ marginRight: "8px" }} />
          {isPending
            ? "Confirming…"
            : status?.isTriggered
            ? "Contract Triggered"
            : "Send Heartbeat"}
        </button>
      </div>

      {/* Contract status banner when triggered */}
      {status?.isTriggered && (
        <div
          style={{
            background: "#1a0a0a",
            border: "1px solid #ef444440",
            borderRadius: "20px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
            color: "#ef4444",
            fontSize: "0.9rem",
          }}
        >
          <i className="fas fa-exclamation-triangle" style={{ marginRight: "8px" }} />
          Grace period has elapsed. The next-of-kin can now call{" "}
          <code>verifyDeath()</code> to begin execution.
        </div>
      )}
    </div>
  );
}
