"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { usePing, useSuccessorStatus, useLastPing } from "@/hooks/useSuccessor";

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function HeartbeatPage() {
  const { address, isConnected } = useAccount();
  const { status, isLoading: statusLoading, refetch } = useSuccessorStatus();
  const { lastPingDate, isLoading: pingLoading } = useLastPing();
  const { ping, isPending, isSuccess, error, isContractConfigured } = usePing();

  // Local heartbeat history (augmented with on-chain data when available)
  const [history, setHistory] = useState<{ time: string; txHash?: string }[]>([]);

  // After a successful ping, record it locally and notify the backend
  useEffect(() => {
    if (!isSuccess) return;

    const now = new Date();
    setHistory((prev) => [
      { time: now.toLocaleString(), txHash: "confirmed" },
      ...prev.slice(0, 9),
    ]);

    toast.success("Heartbeat sent on-chain ✓");
    refetch();
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (error) {
      const msg = (error as Error).message ?? "Transaction failed";
      toast.error(msg.includes("NotOwner")
        ? "Only the contract owner can send a heartbeat"
        : msg.includes("AlreadyTriggered")
        ? "Contract is already triggered — heartbeat not allowed"
        : "Heartbeat failed: " + msg.slice(0, 80));
    }
  }, [error]);

  const handlePing = () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!isContractConfigured) {
      toast.info("Contract not deployed yet — running in demo mode");
      return;
    }
    ping();
  };

  const progressPct = status
    ? status.triggered
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            100 -
              (Number(status.timeRemaining) /
                (Number(status.timeRemaining) + 86400)) *
                100
          )
        )
    : 48;

  const statusColor = status?.isTriggered
    ? "#ef4444"
    : status?.isExecuting || status?.isCompleted
    ? "#D4AF37"
    : "#7A8B5E";

  return (
    <div>
      {/* Heartbeat Monitor Card */}
      <div
        style={{
          background: "#111115",
          border: `1px solid ${statusColor}40`,
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
          {!isContractConfigured && (
            <span style={{ color: "#D4AF37", marginLeft: "8px" }}>
              (demo mode — contract not deployed)
            </span>
          )}
        </p>

        {/* Pulse icon */}
        <div style={{ textAlign: "center", margin: "1.5rem 0" }}>
          <i
            className="fas fa-heartbeat"
            style={{
              fontSize: "3rem",
              color: statusColor,
              animation: isPending ? "pulse 1s infinite" : undefined,
            }}
          />
        </div>

        {/* Status rows */}
        <div
          style={{
            textAlign: "center",
            color: "#888",
            fontSize: "0.85rem",
            marginBottom: "0.5rem",
          }}
        >
          Last ping:{" "}
          {pingLoading
            ? "Loading…"
            : lastPingDate
            ? formatRelativeTime(lastPingDate)
            : "2 hours ago"}
        </div>
        <div
          style={{
            textAlign: "center",
            color: statusColor,
            fontSize: "0.85rem",
            marginBottom: "0.5rem",
          }}
        >
          {statusLoading
            ? "Loading status…"
            : status?.isTriggered
            ? "⚠️ Grace period elapsed — contract triggered"
            : status?.isExecuting
            ? "⚙️ Executing instructions"
            : status?.isCompleted
            ? "✅ Execution completed"
            : `Next required: ${status?.timeRemainingLabel ?? "6d 22h"}`}
        </div>

        {/* Progress bar */}
        <div style={{ margin: "1rem 0" }}>
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

        {/* Contract state badge */}
        {status && (
          <div style={{ textAlign: "center", marginBottom: "1rem" }}>
            <span
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: "20px",
                fontSize: "0.7rem",
                background: `${statusColor}20`,
                color: statusColor,
                border: `1px solid ${statusColor}40`,
              }}
            >
              On-chain state:{" "}
              {["ACTIVE", "TRIGGERED", "EXECUTING", "COMPLETED"][status.currentState]}
            </span>
          </div>
        )}

        <button
          onClick={handlePing}
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
            opacity: status?.isCompleted ? 0.5 : 1,
          }}
        >
          <i className="fas fa-heartbeat" style={{ marginRight: "8px" }} />
          {isPending
            ? "Confirming on-chain…"
            : status?.isTriggered
            ? "Contract Triggered"
            : "Send Heartbeat"}
        </button>
      </div>

      {/* Recent Heartbeats */}
      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: "1.25rem" }}>
          Recent Heartbeats
        </h3>
        {history.length === 0 ? (
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            No heartbeats recorded this session.
          </p>
        ) : (
          history.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid #1E1E24",
                fontSize: "0.85rem",
                color: "#ccc",
              }}
            >
              {item.time}
              <span style={{ marginLeft: "auto", color: "#7A8B5E" }}>
                ✓ Recorded
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
