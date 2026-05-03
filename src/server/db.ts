import "server-only";

import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

import { getDataFilePath } from "./config";
import { makeId, nowIso, stableStringify } from "./crypto";
import type { AuditEvent, BackendState } from "./types";

const initialState: BackendState = {
  version: 1,
  plans: {},
  attestations: {},
  auditLog: [],
};

let writeQueue: Promise<unknown> = Promise.resolve();

export async function readState(): Promise<BackendState> {
  const filePath = resolveDataPath();

  try {
    const raw = await readFile(filePath, "utf8");
    return { ...initialState, ...JSON.parse(raw) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return structuredClone(initialState);
    }

    throw error;
  }
}

export async function updateState<T>(
  mutator: (state: BackendState) => T | Promise<T>
): Promise<T> {
  const run = writeQueue.then(async () => {
    const state = await readState();
    const result = await mutator(state);
    await writeState(state);
    return result;
  });

  writeQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

export function createAuditEvent(
  action: string,
  metadata: Record<string, unknown>,
  planId?: string
): AuditEvent {
  return {
    id: makeId("audit"),
    planId,
    action,
    createdAt: nowIso(),
    metadata,
  };
}

async function writeState(state: BackendState): Promise<void> {
  const filePath = resolveDataPath();
  const dir = path.dirname(filePath);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  await mkdir(dir, { recursive: true });
  await writeFile(tempPath, `${stableStringify(state)}\n`, "utf8");
  await rename(tempPath, filePath);
}

function resolveDataPath(): string {
  const configuredPath = getDataFilePath();
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
}
