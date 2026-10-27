import {assertBonusSnapshotReadAllowed} from './bonusReadOnly';
import { BACKEND_URL } from './backend';
import { assertBonusNetworkAllowed } from './registrationIsolation';
import type {
  BonusSnapshot,
  BonusTransferLog,
  BonusTransferRequest,
} from "./bonus.types";

const API_BASE = BACKEND_URL;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getErrorMessage(
  data: unknown,
  status: number
): string {
  if (isRecord(data)) {
    if (typeof data.message === "string") {
      return data.message;
    }

    if (
      Array.isArray(data.message) &&
      data.message.every(
        (item: unknown) => typeof item === "string"
      )
    ) {
      return data.message.join(", ");
    }
  }

  return `Bonus API error (${status})`;
}

async function request(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<unknown> {
  if(path==="/api/bonus/snapshot"&&(options.method===undefined||options.method==="GET")&&options.body==null)assertBonusSnapshotReadAllowed();
  else assertBonusNetworkAllowed();
  if (!token.trim()) {
    throw new Error("Authentication token is required");
  }

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  if (options.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
    credentials: path === "/api/bonus/snapshot" ? "omit" : options.credentials,
  });

  const text = await response.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Bonus API returned invalid JSON (${response.status}). Check that the bonus server is running on the configured port.`
    );
  }

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, response.status)
    );
  }

  return data;
}

function isSnapshot(
  data: unknown
): data is BonusSnapshot {
  if (
    !isRecord(data) ||
    !isRecord(data.summary) ||
    !Array.isArray(data.items) ||
    !Array.isArray(data.transfers)
  ) {
    return false;
  }

  const numericFields = [
    "balance",
    "confirmed",
    "pending",
    "spent",
    "expired",
    "available",
  ];

  return (
    numericFields.every((key) => {
      const value = data.summary[key];

      return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
      );
    }) &&
    typeof data.summary.lastUpdated === "string" &&
    Number.isFinite(Date.parse(data.summary.lastUpdated)) &&
    data.items.every(isBonusItem) && data.transfers.every(isTransferLog)
  );
}

function isTransferLog(
  data: unknown
): data is BonusTransferLog {
  if (!isRecord(data)) {
    return false;
  }

  return (
    typeof data.id === "string" &&
    typeof data.fromUserId === "number" &&
    Number.isSafeInteger(data.fromUserId) &&
    data.fromUserId > 0 &&
    typeof data.toUserId === "number" &&
    Number.isSafeInteger(data.toUserId) &&
    data.toUserId > 0 &&
    typeof data.fromUsername === "string" &&
    typeof data.toUsername === "string" &&
    typeof data.amount === "number" &&
    Number.isFinite(data.amount) &&
    data.amount > 0 &&
    typeof data.createdAt === "string" &&
    typeof data.expiresAt === "string" &&
    (data.status === "completed" ||
      data.status === "pending")
  );
}

export const bonusApi = {
  async getSnapshot(
    token: string,
    signal?: AbortSignal
  ): Promise<BonusSnapshot> {
    assertBonusSnapshotReadAllowed();
    const data = await request(
      "/api/bonus/snapshot",
      token,
      { signal }
    );

    if (!isSnapshot(data)) {
      throw new Error("Invalid bonus snapshot");
    }

    return data;
  },

  async transferBonus(
    token: string,
    payload: BonusTransferRequest,
    idempotencyKey: string
  ): Promise<BonusTransferLog[]> {
    assertBonusNetworkAllowed();
    const toUsername = payload.toUsername.trim();

    if (!/^[A-Za-z0-9_]{3,30}$/.test(toUsername)) {
      throw new Error("Invalid recipient username");
    }

    if (
      !Array.isArray(payload.bonusIds) ||
      payload.bonusIds.length === 0 ||
      payload.bonusIds.length > 100 ||
      payload.bonusIds.some(
        (id) => typeof id !== "string" || !id.trim()
      ) ||
      new Set(payload.bonusIds).size !==
        payload.bonusIds.length
    ) {
      throw new Error("Select valid bonus IDs");
    }

    if (
      !/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)
    ) {
      throw new Error("Invalid idempotency key");
    }

    const data = await request(
      "/api/bonus/transfer",
      token,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          toUsername,
          bonusIds: payload.bonusIds,
        }),
      }
    );

    if (
      !Array.isArray(data) ||
      !data.every(isTransferLog)
    ) {
      throw new Error("Invalid transfer response");
    }

    return data;
  },
};

function isBonusItem(value:unknown):boolean {
 if(!isRecord(value))return false;
 return typeof value.id==="string"&&!!value.id&&Number.isSafeInteger(value.userId)&&Number(value.userId)>0&&
 ["ads","research","transfer","purchase","refund"].includes(String(value.source))&&
 ["pending","confirmed","spent","expired","failed"].includes(String(value.status))&&
 typeof value.amount==="number"&&Number.isFinite(value.amount)&&value.amount>=0&&
 typeof value.isExpired==="boolean"&&
 ["createdAt","expiresAt"].every(k=>typeof value[k]==="string"&&Number.isFinite(Date.parse(value[k] as string)))&&
 (value.usedAt==null||(typeof value.usedAt==="string"&&Number.isFinite(Date.parse(value.usedAt))))&&
 ["orderId","referenceId"].every(k=>value[k]==null||typeof value[k]==="string");
}
