"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { toast } from "sonner";
import {
  useSetKinAddress,
  useContractKin,
  useSuccessorStatus,
  useVerifyDeath,
} from "@/hooks/useSuccessor";
import { truncateAddress } from "@/lib/utils";

export default function NextOfKinPage() {
  const { address, isConnected } = useAccount();
  const { kinAddress, isLoading: kinLoading, refetch: refetchKin } = useContractKin();
  const { status } = useSuccessorStatus();

  // ── Set kin ──────────────────────────────────────────────────────────────
  const [newKinAddress, setNewKinAddress] = useState("");
  const {
    setKin,
    isPending: setKinPending,
    isSuccess: setKinSuccess,
    error: setKinError,
    isContractConfigured,
  } = useSetKinAddress();

  useEffect(() => {
    if (setKinSuccess) {
      toast.success("Next-of-kin updated on-chain ✓");
      setNewKinAddress("");
      refetchKin();
    }
  }, [setKinSuccess, refetchKin]);

  useEffect(() => {
    if (setKinError) {
      const msg = (setKinError as Error).message ?? "";
      toast.error(
        msg.includes("NotOwner")
          ? "Only the contract owner can change the kin address"
          : msg.includes("AlreadyTriggered")
          ? "Cannot change kin after contract is triggered"
          : "Transaction failed"
      );
    }
  }, [setKinError]);

  const handleSetKin = () => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!isAddress(newKinAddress)) { toast.error("Enter a valid 0x wallet address"); return; }
    if (!isContractConfigured) { toast.info("Contract not deployed — demo mode"); return; }
    setKin(newKinAddress as `0x${string}`);
  };

  // ── Verify death (kin only) ───────────────────────────────────────────────
  const {
    verifyDeath,
    isPending: verifyPending,
    isSuccess: verifySuccess,
    error: verifyError,
  } = useVerifyDeath();

  useEffect(() => {
    if (verifySuccess) toast.success("Death verified on-chain — execution started ✓");
  }, [verifySuccess]);

  useEffect(() => {
    if (verifyError) {
      const msg = (verifyError as Error).message ?? "";
      toast.error(
        msg.includes("NotKin")
          ? "Only the registered kin can verify death"
          : msg.includes("GracePeriodNotElapsed")
          ? "Grace period has not elapsed yet"
          : "Verification failed"
      );
    }
  }, [verifyError]);

  const isKin =
    address && kinAddress
      ? address.toLowerCase() === kinAddress.toLowerCase()
      : false;

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
            {kinLoading ? (
              <p style={{ color: "#555", fontSize: "0.85rem" }}>Loading…</p>
            ) : kinAddress ? (
              <>
                <h4 style={{ fontWeight: 600, fontFamily: "monospace" }}>
                  {truncateAddress(kinAddress)}
                </h4>
                <span style={{ color: "#7A8B5E", fontSize: "0.8rem" }}>
                  ✓ Registered on-chain
                </span>
              </>
            ) : (
              <p style={{ color: "#555", fontSize: "0.85rem" }}>
                No kin address set
              </p>
            )}
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
          marginBottom: "1.5rem",
          opacity: status?.isTriggered ? 0.5 : 1,
        }}
      >
        <h3 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
          Update Next of Kin
        </h3>
        <p style={{ color: "#888", fontSize: "0.8rem", marginBottom: "1.25rem" }}>
          Enter the wallet address of your next-of-kin. They will be able to
          verify your death and trigger execution.
        </p>
        <input
          type="text"
          placeholder="0x… wallet address"
          value={newKinAddress}
          onChange={(e) => setNewKinAddress(e.target.value)}
          disabled={!!status?.isTriggered}
          style={inputStyle}
        />
        <button
          onClick={handleSetKin}
          disabled={setKinPending || !!status?.isTriggered}
          style={{
            width: "100%",
            background:
              setKinPending || status?.isTriggered
                ? "#333"
                : "linear-gradient(135deg,#7A8B5E,#5A6B3E)",
            border: "none",
            padding: "12px",
            borderRadius: "40px",
            color: "#fff",
            fontWeight: 600,
            cursor: setKinPending || status?.isTriggered ? "not-allowed" : "pointer",
          }}
        >
          <i className="fas fa-paper-plane" style={{ marginRight: "8px" }} />
          {setKinPending ? "Confirming…" : "Set Kin Address On-Chain"}
        </button>
      </div>

      {/* Verify Death (kin only, shown when triggered) */}
      {(status?.isTriggered || status?.isExecuting) && (
        <div
          style={{
            background: "#1a0a0a",
            border: "1px solid #ef444440",
            borderRadius: "20px",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#ef4444" }}>
            ⚠️ Grace Period Elapsed
          </h3>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
            {isKin
              ? "As the registered next-of-kin, you can now verify death and begin execution of the will."
              : "The grace period has elapsed. The registered next-of-kin must verify death to begin execution."}
          </p>
          {isKin && !status.isExecuting && !status.isCompleted && (
            <button
              onClick={() => verifyDeath()}
              disabled={verifyPending}
              style={{
                width: "100%",
                background: verifyPending ? "#333" : "linear-gradient(135deg,#ef4444,#b91c1c)",
                border: "none",
                padding: "12px",
                borderRadius: "40px",
                color: "#fff",
                fontWeight: 600,
                cursor: verifyPending ? "not-allowed" : "pointer",
              }}
            >
              <i className="fas fa-check-circle" style={{ marginRight: "8px" }} />
              {verifyPending ? "Confirming…" : "Verify Death & Begin Execution"}
            </button>
          )}
          {status.isExecuting && (
            <p style={{ color: "#D4AF37", fontSize: "0.85rem" }}>
              ⚙️ Execution in progress…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
