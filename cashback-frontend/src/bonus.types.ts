export type BonusSource =
  | "ads"
  | "research"
  | "transfer"
  | "purchase"
  | "refund";

export type BonusStatus =
  | "pending"
  | "confirmed"
  | "spent"
  | "expired"
  | "failed";

export interface BonusItem {
  id: string;
  userId: number;
  source: BonusSource;
  amount: number;
  status: BonusStatus;
  expiresAt: string;
  createdAt: string;
  usedAt?: string | null;
  isExpired?: boolean;
  referenceId?: string | null;
  orderId?: string | null;
  transferMeta?: {
    fromUserId?: number | null;
    toUserId?: number | null;
    fromUsername?: string | null;
    toUsername?: string | null;
  };
}

export interface BonusSummary {
  balance: number;
  confirmed: number;
  pending: number;
  spent: number;
  expired: number;
  available: number;
  lastUpdated: string;
}

export interface BonusTransferLog {
  id: string;
  fromUserId: number;
  toUserId: number;
  fromUsername: string;
  toUsername: string;
  amount: number;
  createdAt: string;
  expiresAt: string;
  status: "completed" | "pending";
}

export interface BonusTransferRequest {
  toUsername: string;
  bonusIds: string[];
}

export interface BonusSnapshot {
  summary: BonusSummary;
  items: BonusItem[];
  transfers: BonusTransferLog[];
}