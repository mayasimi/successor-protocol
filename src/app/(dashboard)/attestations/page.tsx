"use client";

import { useEffect, useState } from "react";

interface Attestation {
  id: string;
  type: string;
  action: string;
  txHash: string;
  network: string;
  explorerUrl?: string;
  createdAt: string;
  planId: string;
}

const TYPE_ICONS: Record<string, string> = {
  plan_created:          "🔗",
  plan_updated:          "✏️",
  passport_session:      "🛂",
  beneficiary_added:     "👤",
  beneficiary_confirmed: "✅",
  instruction_added:     "📋",
  heartbeat_recorded:    "❤️",
  heartbeat_missed:      "⚠️",
  execution_started:     "⚙️",
  instruction_executed:  "✓",
  instruction_failed:    "✗",
  execution_completed:   "🏁",
};

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\./g, " › ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/attestations");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setAttestations(json.data ?? []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
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
          <h3 style={{ fontWeight: 600 }}>Attestation Ledger</h3>
          <span style={{ color: "#555", fontSize: "0.75rem" }}>
            {isLoading ? "Loading…" : `${attestations.length} records`}
          </span>
        </div>

        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "1rem" }}>
            Failed to load attestations: {error}
          </p>
        )}

        {!isLoading && attestations.length === 0 && !error && (
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            No attestations yet. Create a plan to get started.
          </p>
        )}

        {attestations.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 0",
              borderBottom: "1px solid #1E1E24",
              fontSize: "0.85rem",
              color: "#ccc",
            }}
          >
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
              {TYPE_ICONS[a.type] ?? "📄"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{formatAction(a.action)}</div>
              <div style={{ fontSize: "0.7rem", color: "#555", marginTop: "2px" }}>
                {new Date(a.createdAt).toLocaleString()} ·{" "}
                <span style={{ textTransform: "capitalize" }}>{a.network}</span>
              </div>
            </div>
            {a.explorerUrl ? (
              <a
                href={a.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#D4AF37",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                {truncateHash(a.txHash)} 🔗
              </a>
            ) : (
              <span
                style={{
                  color: "#555",
                  fontSize: "0.75rem",
                  flexShrink: 0,
                  fontFamily: "monospace",
                }}
              >
                {truncateHash(a.txHash)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
