import type { HeartbeatState, HeartbeatStatus, PlanStatus } from "./types";
import { addDaysIso, nowIso } from "./crypto";

export interface HeartbeatInput {
  intervalDays: number;
  gracePeriodDays: number;
  lastCheckInAt?: string;
  onChainTxHash?: string;
}

export function createHeartbeatState(input: HeartbeatInput): HeartbeatState {
  const lastCheckInAt = input.lastCheckInAt ?? nowIso();
  const nextCheckInDueAt = addDaysIso(lastCheckInAt, input.intervalDays);
  const executionEligibleAt = addDaysIso(
    nextCheckInDueAt,
    input.gracePeriodDays
  );

  return {
    intervalDays: input.intervalDays,
    gracePeriodDays: input.gracePeriodDays,
    lastCheckInAt,
    nextCheckInDueAt,
    executionEligibleAt,
    status: deriveHeartbeatStatus(nextCheckInDueAt, executionEligibleAt),
    onChainTxHash: input.onChainTxHash,
  };
}

export function refreshHeartbeatStatus(
  heartbeat: HeartbeatState,
  now = nowIso()
): HeartbeatState {
  return {
    ...heartbeat,
    status: deriveHeartbeatStatus(
      heartbeat.nextCheckInDueAt,
      heartbeat.executionEligibleAt,
      now
    ),
  };
}

export function derivePlanStatus(
  currentStatus: PlanStatus,
  heartbeat: HeartbeatState
): PlanStatus {
  if (
    currentStatus === "paused" ||
    currentStatus === "executing" ||
    currentStatus === "completed"
  ) {
    return currentStatus;
  }

  if (heartbeat.status === "triggered") {
    return "triggered";
  }

  if (heartbeat.status === "warning") {
    return "warning";
  }

  return "active";
}

export function isExecutionEligible(heartbeat: HeartbeatState, now = nowIso()) {
  return new Date(now).getTime() >= new Date(heartbeat.executionEligibleAt).getTime();
}

function deriveHeartbeatStatus(
  nextCheckInDueAt: string,
  executionEligibleAt: string,
  now = nowIso()
): HeartbeatStatus {
  const nowMs = new Date(now).getTime();

  if (nowMs >= new Date(executionEligibleAt).getTime()) {
    return "triggered";
  }

  if (nowMs >= new Date(nextCheckInDueAt).getTime()) {
    return "warning";
  }

  return "active";
}
