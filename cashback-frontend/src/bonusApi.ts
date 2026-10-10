import type {
  BonusSnapshot,
  BonusTransferLog,
  BonusTransferRequest,
} from "./bonus.types";

const API_BASE = (
  process.env.REACT_APP_BONUS_API_BASE ??
  "http://localhost:3002"
)
  .trim()
  .replace(/\/+$/, "");

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
    typeof data.summary.lastUpdated === "string"
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