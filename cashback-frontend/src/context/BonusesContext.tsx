import {canReadBonusSnapshot} from '../bonusReadOnly';
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
import { registrationIsolated, assertBonusNetworkAllowed } from '../registrationIsolation';

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
    canReadBonusSnapshot() && !loading && user?.email_verified === true
      ? token
      : null;

  // Keep routing children mounted; bonus state is scoped inside the store.
  return (
    <BonusStore token={activeToken} userId={user?.id}>
      {children}
    </BonusStore>
  );
}

function BonusStore({
  children,
  token,
  userId,
}: {
  children: React.ReactNode;
  token: string | null;
  userId: number | undefined;
}) {
  const sessionKey = JSON.stringify([userId ?? null, token]);
  const currentSession = useRef(sessionKey);
  currentSession.current = sessionKey;
  const [stored, setStored] = useState<{owner:string; value:BonusSnapshot|null}>({owner:sessionKey,value:null});
  const [status, setStatus] = useState<{owner:string; loading:boolean; error:string|null}>({owner:sessionKey,loading:Boolean(token),error:null});
  // Mask old data synchronously, before effect cleanup or a new request.
  const snapshot = stored.owner === sessionKey ? stored.value : null;
  const loading = status.owner === sessionKey ? status.loading : Boolean(token);
  const error = status.owner === sessionKey ? status.error : null;
  const setSnapshot = useCallback((value:BonusSnapshot|null) => setStored({owner:sessionKey,value}),[sessionKey]);
  const setLoading = useCallback((value:boolean) => setStatus(s=>({owner:sessionKey,loading:value,error:s.owner===sessionKey?s.error:null})),[sessionKey]);
  const setError = useCallback((value:string|null) => setStatus(s=>({owner:sessionKey,loading:s.owner===sessionKey?s.loading:Boolean(token),error:value})),[sessionKey,token]);

  const active = useRef(true);
  const revision = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!canReadBonusSnapshot()) return;
    if (!token || !active.current || currentSession.current !== sessionKey) return;

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

      if(next.items.some(item=>item.userId!==userId)||next.transfers.some(entry=>entry.fromUserId!==userId&&entry.toUserId!==userId))throw new Error("Invalid bonus snapshot");
      if (
        active.current &&
        currentSession.current === sessionKey &&
        currentRevision === revision.current
      ) {
        setSnapshot(next);
      }
    } catch (err) {
      if (
        !active.current ||
        currentSession.current !== sessionKey ||
        currentRevision !== revision.current ||
        currentController.signal.aborted
      ) {
        return;
      }

      // Не разрешаем использовать устаревший баланс.
      setSnapshot(null);
      setError("Could not load bonuses");

      throw err;
    } finally {
      if (
        active.current &&
        currentSession.current === sessionKey &&
        currentRevision === revision.current
      ) {
        setLoading(false);
      }
    }
  }, [token,userId,sessionKey,setSnapshot,setLoading,setError]);

  useEffect(() => {
    active.current = true;
    setSnapshot(null);
    setLoading(Boolean(token));
    setError(null);

    if (!token || !canReadBonusSnapshot()) {
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
  }, [token, refresh,setSnapshot,setLoading,setError]);

  const transfer = useCallback(
    async (
      payload: BonusTransferRequest,
      idempotencyKey: string
    ) => {
      assertBonusNetworkAllowed();
      if (!token || !active.current || currentSession.current !== sessionKey) {
        throw new Error("Sign in and verify your email");
      }

      const result = await bonusApi.transferBonus(
        token,
        payload,
        idempotencyKey
      );

      if (!active.current || currentSession.current !== sessionKey) {
        throw new Error(
          "Session changed. Check transfer history after signing in."
        );
      }

      // Перевод уже выполнен: ошибка обновления не отменяет его.
      await refresh().catch(() => {});
      return result;
    },
    [token, refresh,sessionKey]
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
      (registrationIsolated()?[]:items)
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
