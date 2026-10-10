import type {
  BonusItem,
  BonusSnapshot,
  BonusSummary,
  BonusTransferLog,
  BonusTransferRequest,
} from "../bonus.types";

const API_BASE = process.env.REACT_APP_API_BASE ?? "http://localhost:3001";

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export const bonusApi = {
  async getSnapshot(userId: number): Promise<BonusSnapshot> {
    const r = await fetch(`${API_BASE}/api/bonus/snapshot?userId=${userId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!r.ok) {
      throw new Error("Could not load bonus snapshot");
    }

    return parseJson<BonusSnapshot>(r);
  },

  async getSummary(userId: number): Promise<BonusSummary> {
    const r = await fetch(`${API_BASE}/api/bonus/summary?userId=${userId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!r.ok) {
      throw new Error("Could not load bonus summary");
    }

    return parseJson<BonusSummary>(r);
  },

  async getItems(userId: number): Promise<BonusItem[]> {
    const r = await fetch(`${API_BASE}/api/bonus/items?userId=${userId}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!r.ok) {
      throw new Error("Could not load bonus items");
    }

    return parseJson<BonusItem[]>(r);
  },

  async transferBonus(payload: BonusTransferRequest): Promise<BonusTransferLog[]> {
    const r = await fetch(`${API_BASE}/api/bonus/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      throw new Error("Could not transfer bonuses");
    }

    return parseJson<BonusTransferLog[]>(r);
  },

  async consumeBonusesForPurchase(
    userId: number,
    bonusIds: string[],
    orderId: string
  ): Promise<void> {
    const r = await fetch(`${API_BASE}/api/bonus/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, bonusIds, orderId }),
    });

    if (!r.ok) {
      throw new Error("Could not consume bonuses");
    }
  },

  async refreshExpiredBonuses(userId: number): Promise<void> {
    const r = await fetch(`${API_BASE}/api/bonus/refresh-expired`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!r.ok) {
      throw new Error("Could not refresh bonus expiries");
    }
  },
};