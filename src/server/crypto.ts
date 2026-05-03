import "server-only";

import { createHash, createHmac, randomBytes, randomUUID } from "crypto";

import type { IsoDateString } from "./types";

export function nowIso(): IsoDateString {
  return new Date().toISOString();
}

export function addDaysIso(value: IsoDateString, days: number): IsoDateString {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function addHoursIso(value: IsoDateString, hours: number): IsoDateString {
  const date = new Date(value);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}

export function makeId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function makeTxHash(): `0x${string}` {
  return `0x${randomBytes(32).toString("hex")}`;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function sha256Bytes32(value: unknown): `0x${string}` {
  return `0x${sha256Hex(value)}`;
}

export function signDigest(digest: string): string | undefined {
  const secret = process.env.SUCCESSOR_ATTESTATION_SECRET;

  if (!secret) {
    return undefined;
  }

  return createHmac("sha256", secret).update(digest).digest("hex");
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const item = (value as Record<string, unknown>)[key];

      if (typeof item !== "undefined") {
        acc[key] = sortValue(item);
      }

      return acc;
    }, {});
}
