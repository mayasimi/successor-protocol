"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { toast } from "sonner";
import { useAddInstruction, useSuccessorStatus } from "@/hooks/useSuccessor";

interface LocalInstruction {
  description: string;
  target: string;
  addedAt: string;
  txHash?: string;
}

const INSTRUCTION_TYPES = [
  { value: "notify", label: "Notify Contact" },
  { value: "transfer", label: "Transfer ZG" },
  { value: "custom", label: "Custom Call" },
] as const;

export default function MyWillPage() {
  const { isConnected } = useAccount();
  const { status } = useSuccessorStatus();
  const {
    addInstruction,
    isPending,
    isSuccess,
    error,
    reset,
    isContractConfigured,
  } = useAddInstruction();

  const [instructions, setInstructions] = useState<LocalInstruction[]>([]);
  const [type, setType] = useState<"notify" | "transfer" | "custom">("notify");
  const [description, setDescription] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [valueZg, setValueZg] = useState("");

  useEffect(() => {
    if (isSuccess) {
      toast.success("Instruction queued on-chain ✓");
      setInstructions((prev) => [
        {
          description,
          target: targetAddress || "0x0000000000000000000000000000000000000000",
          addedAt: new Date().toLocaleString(),
          txHash: "confirmed",
        },
        ...prev,
      ]);
      setDescription("");
      setTargetAddress("");
      setValueZg("");
      reset();
    }
  }, [isSuccess, description, targetAddress, reset]);

  useEffect(() => {
    if (error) {
      const msg = (error as Error).message ?? "";
      toast.error(
        msg.includes("NotOwner")
          ? "Only the contract owner can add instructions"
          : msg.includes("AlreadyTriggered")
          ? "Cannot add instructions after contract is triggered"
          : "Transaction failed"
      );
    }
  }, [error]);

  const handleAdd = () => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!description.trim()) { toast.error("Enter a description"); return; }

    const target = targetAddress.trim() || "0x0000000000000000000000000000000000000000";
    if (!isAddress(target)) { toast.error("Enter a valid target address"); return; }

    if (!isContractConfigured) {
      // Demo mode: just add locally
      toast.info("Contract not deployed — saved locally only");
      setInstructions((prev) => [
        { description, target, addedAt: new Date().toLocaleString() },
        ...prev,
      ]);
      setDescription("");
      setTargetAddress("");
      setValueZg("");
      return;
    }

    const valueWei =
      valueZg && Number(valueZg) > 0
        ? BigInt(Math.floor(Number(valueZg) * 1e18))
        : 0n;

    addInstruction({
      target: target as `0x${string}`,
      data: "0x",
      value: valueWei,
      description: description.trim(),
    });
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

  const isLocked = !!status?.isTriggered || !!status?.isExecuting || !!status?.isCompleted;

  return (
    <div>
      {/* Instruction list */}
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
          Queued Instructions
          {!isContractConfigured && (
            <span style={{ color: "#D4AF37", fontSize: "0.7rem", marginLeft: "8px" }}>
              demo mode
            </span>
          )}
        </h3>
        {instructions.length === 0 ? (
          <p style={{ color: "#555", fontSize: "0.85rem" }}>
            No instructions added yet.
          </p>
        ) : (
          instructions.map((inst, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid #1E1E24",
                fontSize: "0.85rem",
                color: "#ccc",
                gap: "12px",
              }}
            >
              <i className="fas fa-file-alt" style={{ color: "#7A8B5E" }} />
              <div style={{ flex: 1 }}>
                <div>{inst.description}</div>
                <div style={{ fontSize: "0.7rem", color: "#555", marginTop: "2px" }}>
                  {inst.target} · {inst.addedAt}
                </div>
              </div>
              {inst.txHash && (
                <span style={{ color: "#7A8B5E", fontSize: "0.7rem" }}>✓ On-chain</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add instruction form */}
      <div
        style={{
          background: "#111115",
          border: "1px solid #1E1E24",
          borderRadius: "20px",
          padding: "1.5rem",
          opacity: isLocked ? 0.5 : 1,
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
          Add Instruction
        </h3>
        <p style={{ color: "#888", fontSize: "0.8rem", marginBottom: "1.25rem" }}>
          Instructions are stored on-chain and executed automatically when the
          will is triggered.
        </p>

        {/* Type selector */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1rem" }}>
          {INSTRUCTION_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              disabled={isLocked}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: `1px solid ${type === t.value ? "#7A8B5E" : "#1E1E24"}`,
                background: type === t.value ? "rgba(122,139,94,0.15)" : "transparent",
                color: type === t.value ? "#7A8B5E" : "#888",
                cursor: isLocked ? "not-allowed" : "pointer",
                fontSize: "0.8rem",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Description (e.g. Send 1 ZG to Jamie)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isLocked}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="Target address (0x…)"
          value={targetAddress}
          onChange={(e) => setTargetAddress(e.target.value)}
          disabled={isLocked}
          style={inputStyle}
        />
        {type === "transfer" && (
          <input
            type="number"
            placeholder="ZG amount (e.g. 0.5)"
            value={valueZg}
            onChange={(e) => setValueZg(e.target.value)}
            disabled={isLocked}
            style={inputStyle}
            min="0"
            step="0.001"
          />
        )}

        <button
          onClick={handleAdd}
          disabled={isPending || isLocked}
          style={{
            width: "100%",
            background:
              isPending || isLocked
                ? "#333"
                : "linear-gradient(135deg,#7A8B5E,#5A6B3E)",
            border: "none",
            padding: "12px",
            borderRadius: "40px",
            color: "#fff",
            fontWeight: 600,
            cursor: isPending || isLocked ? "not-allowed" : "pointer",
          }}
        >
          <i className="fas fa-plus" style={{ marginRight: "8px" }} />
          {isPending
            ? "Confirming on-chain…"
            : isLocked
            ? "Contract Locked"
            : "Add Instruction On-Chain"}
        </button>
      </div>
    </div>
  );
}
