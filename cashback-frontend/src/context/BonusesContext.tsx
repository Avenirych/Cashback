import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { bonusApi } from "../bonusApi";

import type {
  BonusItem,
  BonusSnapshot,
  BonusSummary,
  BonusTransferLog,
  BonusTransferRequest,
} from "../bonus.types";

interface BonusesContextValue {
  summary: BonusSummary | null;
  items: BonusItem[];
  transfers: BonusTransferLog[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  transfer: (
    payload: BonusTransferRequest,
    idempotencyKey: string
  ) => Promise<BonusTransferLog[]>;
  availableBonusIds: string[];
  availableAmount: number;
}

const BonusesContext =
  createContext<BonusesContextValue | null>(null);

export function BonusesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, token, loading } = useAuth();

  const activeToken =
    !loading && user?.email_verified === true
      ? token
      : null;

  // Перемонтирование исключает показ данных прошлого аккаунта.
  const sessionKey = JSON.stringify([
    user?.id ?? null,
    activeToken,
  ]);

  return (
    <BonusStore key={sessionKey} token={activeToken}>
      {children}
    </BonusStore>
  );
}

function BonusStore({
  children,
  token,
}: {
  children: React.ReactNode;
  token: string | null;
}) {
  const [snapshot, setSnapshot] =
    useState<BonusSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);

  const active = useRef(true);
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !active.current) return;

    const currentRevision = ++revision.current;

    controller.current?.abort();
    const currentController = new AbortController();
    controller.current = currentController;

    setLoading(true);
    setError(null);

    try {
      const next = await bonusApi.getSnapshot(
        token,
        currentController.signal
      );

      if (
        active.current &&
        currentRevision === revision.current
      ) {
        setSnapshot(next);
      }
    } catch (err) {
      if (
        !active.current ||
        currentRevision !== revision.current ||
        currentController.signal.aborted
      ) {
        return;
      }

      // Не разрешаем использовать устаревший баланс.
      setSnapshot(null);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load bonuses"
      );

      throw err;
    } finally {
      if (
        active.current &&
        currentRevision === revision.current
      ) {
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    active.current = true;

    if (!token) {
      return () => {
        active.current = false;
      };
    }

    const reload = () => {
      if (document.visibilityState === "visible") {
        void refresh().catch(() => {});
      }
    };

    void refresh().catch(() => {});

    const timer = window.setInterval(reload, 30000);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reload);

    return () => {
      active.current = false;
      revision.current += 1;
      controller.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [token, refresh]);

  const transfer = useCallback(
    async (
      payload: BonusTransferRequest,
      idempotencyKey: string
    ) => {
      if (!token || !active.current) {
        throw new Error("Sign in and verify your email");
      }

      const result = await bonusApi.transferBonus(
        token,
        payload,
        idempotencyKey
      );

      if (!active.current) {
        throw new Error(
          "Session changed. Check transfer history after signing in."
        );
      }

      // Перевод уже выполнен: ошибка обновления не отменяет его.
      await refresh().catch(() => {});
      return result;
    },
    [token, refresh]
  );

  const items = useMemo(
    () => snapshot?.items ?? [],
    [snapshot]
  );

  const transfers = useMemo(
    () => snapshot?.transfers ?? [],
    [snapshot]
  );

  const availableBonusIds = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.status === "confirmed" &&
            item.isExpired !== true
        )
        .map((item) => item.id),
    [items]
  );

  const value = useMemo<BonusesContextValue>(
    () => ({
      summary: snapshot?.summary ?? null,
      items,
      transfers,
      loading,
      error,
      refresh,
      transfer,
      availableBonusIds,
      availableAmount: snapshot?.summary.available ?? 0,
    }),
    [
      snapshot,
      items,
      transfers,
      loading,
      error,
      refresh,
      transfer,
      availableBonusIds,
    ]
  );

  return (
    <BonusesContext.Provider value={value}>
      {children}
    </BonusesContext.Provider>
  );
}

export function useBonuses() {
  const context = useContext(BonusesContext);

  if (!context) {
    throw new Error(
      "useBonuses must be used inside BonusesProvider"
    );
  }

  return context;
}