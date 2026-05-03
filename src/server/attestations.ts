import "server-only";

import { getKiteConfig } from "./config";
import { makeId, nowIso, sha256Bytes32, sha256Hex, signDigest } from "./crypto";
import { createAuditEvent, updateState } from "./db";
import { submitAttestation } from "./kite";
import type { Attestation, AttestationType } from "./types";

export interface CreateAttestationInput {
  planId: string;
  type: AttestationType;
  action: string;
  subjectId?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function createAttestation(
  input: CreateAttestationInput
): Promise<Attestation> {
  const config = getKiteConfig();
  const createdAt = nowIso();
  const canonicalPayload = {
    planId: input.planId,
    type: input.type,
    action: input.action,
    subjectId: input.subjectId,
    payload: input.payload,
    createdAt,
  };
  const digest = sha256Hex(canonicalPayload);
  const payloadHash = sha256Bytes32(canonicalPayload);

  let attestation: Attestation = {
    id: makeId("att"),
    planId: input.planId,
    type: input.type,
    action: input.action,
    subjectId: input.subjectId,
    payloadHash,
    proof: {
      algorithm: "sha256",
      payloadHash: `sha256:${digest}`,
      canonicalDigest: digest,
      signature: signDigest(digest),
      signedAt: createdAt,
    },
    txHash: "0x",
    chainId: config.chainId,
    network: config.network,
    explorerUrl: undefined,
    createdAt,
    metadata: input.metadata ?? {},
  };

  const receipt = await submitAttestation(attestation);
  attestation = {
    ...attestation,
    txHash: receipt.txHash,
    chainId: receipt.chainId,
    network: receipt.network,
    explorerUrl: receipt.explorerUrl,
    metadata: {
      ...attestation.metadata,
      receipt: receipt.metadata,
    },
  };

  await updateState((state) => {
    state.attestations[attestation.id] = attestation;
    state.auditLog.push(
      createAuditEvent(
        "attestation.created",
        {
          attestationId: attestation.id,
          type: attestation.type,
          action: attestation.action,
          txHash: attestation.txHash,
        },
        attestation.planId
      )
    );
  });

  return attestation;
}

export async function listAttestations(planId?: string, type?: string) {
  const { readState } = await import("./db");
  const state = await readState();

  return Object.values(state.attestations)
    .filter((attestation) => !planId || attestation.planId === planId)
    .filter((attestation) => !type || attestation.type === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
