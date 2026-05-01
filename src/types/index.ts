export interface User {
  id: string;
  name: string;
  email: string;
  walletAddress?: string;
  createdAt: string;
}

export interface NextOfKin {
  id: string;
  name: string;
  email: string;
  walletAddress?: string;
  allocationPercent: number;
  status: "pending" | "confirmed" | "declined";
}

export interface WillAsset {
  id: string;
  name: string;
  type: "crypto" | "nft" | "document";
  value?: string;
  recipientId: string;
}

export interface Heartbeat {
  lastCheckIn: string;
  intervalDays: number;
  gracePeriodDays: number;
  status: "active" | "warning" | "triggered";
}

export interface Attestation {
  id: string;
  txHash: string;
  createdAt: string;
  type: "will" | "kin" | "heartbeat";
}
