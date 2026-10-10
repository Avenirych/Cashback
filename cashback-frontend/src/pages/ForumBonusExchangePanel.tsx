import React, { useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBonuses } from "../context/BonusesContext";
import "./ForumBonusExchangePanel.css";

export default function ForumBonusExchangePanel({
  lang,
}: {
  lang: string;
}) {
  const { user, forumUser } = useAuth();
  const {
    items,
    transfers,
    availableBonusIds,
    loading,
    error,
    refresh,
    transfer,
  } = useBonuses();

  const isRu = lang.toUpperCase() === "RU";
  const text = (ru: string, en: string) => (isRu ? ru : en);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [receiver, setReceiver] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const locked = useRef(false);
  const requestRef = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const available = useMemo(() => {
    const ids = new Set(availableBonusIds);

    return items
      .filter((item) => ids.has(item.id))
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  }, [items, availableBonusIds]);

  const selected = available.filter(
    (item) => selectedIds.includes(item.id)
  );

  const selectedAmount =
    Math.round(
      selected.reduce((sum, item) => sum + item.amount, 0) * 100
    ) / 100;

  const incoming = transfers.filter(
    (entry) => entry.toUserId === user?.id
  );

  const outgoing = transfers.filter(
    (entry) => entry.fromUserId === user?.id
  );

  const canTransfer = Boolean(
    user?.email_verified &&
      forumUser &&
      !forumUser.banned
  );

  function formatDate(value: string) {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString(isRu ? "ru-RU" : "en-GB");
  }

  function sourceLabel(source: string) {
    switch (source) {
      case "ads":
        return text("Реклама", "Ads");
      case "research":
        return text("Исследования", "Research");
      case "transfer":
        return text("Перевод", "Transfer");
      case "purchase":
        return text("Покупка", "Purchase");
      case "refund":
        return text("Возврат", "Refund");
      default:
        return source;
    }
  }

  function toggle(id: string) {
    if (busy) return;

    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id]
    );

    setMessage("");
  }

  async function share() {
    if (locked.current || loading) return;

    if (!canTransfer || !forumUser) {
      setMessage(
        text("Сначала войдите на форум", "Sign in to the forum first")
      );
      return;
    }

    const toUsername = receiver.trim();

    if (!/^[A-Za-z0-9_]{3,30}$/.test(toUsername)) {
      setMessage(
        text(
          "Укажите username получателя: 3–30 латинских букв, цифр или _",
          "Enter a recipient username: 3–30 letters, digits or _"
        )
      );
      return;
    }

    if (
      toUsername.toLowerCase() ===
      forumUser.username.toLowerCase()
    ) {
      setMessage(
        text("Нельзя отправить себе", "Cannot transfer to yourself")
      );
      return;
    }

    if (selected.length === 0) {
      setMessage(
        text("Выберите доступные бонусы", "Select available bonuses")
      );
      return;
    }

    const bonusIds = selected.map((item) => item.id).sort();
    const fingerprint = JSON.stringify({ toUsername, bonusIds });

    if (requestRef.current?.fingerprint !== fingerprint) {
      requestRef.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }

    locked.current = true;
    setBusy(true);
    setMessage("");

    try {
      await transfer(
        { toUsername, bonusIds },
        requestRef.current.key
      );

      requestRef.current = null;
      setSelectedIds([]);
      setReceiver("");
      setMessage(
        text("Перевод выполнен", "Transfer completed")
      );
    } catch (err) {
      // При повторе того же намерения сохраняем ключ запроса.
      setMessage(
        err instanceof Error
          ? err.message
          : text("Перевод не выполнен", "Transfer failed")
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="fx-panel">
      <h2>
        {text(
          "Обмен бонусами между участниками",
          "Bonus exchange between members"
        )}
      </h2>

      <div className="fx-row">
        <span>{text("Текущий пользователь:", "Current user:")}</span>
        <strong>{forumUser?.username ?? "—"}</strong>

        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void refresh().catch(() => {})}
        >
          {text("Обновить", "Refresh")}
        </button>
      </div>

      {loading && <p role="status">{text("Загрузка…", "Loading…")}</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}

      <div className="fx-table-wrap">
        <table className="fx-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{text("Источник", "Source")}</th>
              <th>{text("Бонусы", "Amount")}</th>
              <th>{text("Действует до", "Expires at")}</th>
              <th>{text("Выбор", "Selection")}</th>
            </tr>
          </thead>
          <tbody>
            {available.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  {text("Нет доступных бонусов", "No available bonuses")}
                </td>
              </tr>
            ) : (
              available.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{sourceLabel(item.source)}</td>
                  <td>{item.amount.toFixed(2)}</td>
                  <td>{formatDate(item.expiresAt)}</td>
                  <td className="fx-actions">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      disabled={!canTransfer || busy || loading}
                    >
                      {selectedIds.includes(item.id)
                        ? text("Отменить", "Cancel")
                        : text("Выбрать", "Select")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="fx-share">
        <div>
          {text("Выбрано:", "Selected:")}{" "}
          <strong>{selectedAmount.toFixed(2)}</strong>
        </div>

        <input
          type="text"
          aria-label={text("Username получателя", "Recipient username")}
          placeholder={text("Username получателя", "Recipient username")}
          value={receiver}
          onChange={(event) => {
            setReceiver(event.target.value);
            setMessage("");
          }}
          disabled={!canTransfer || busy}
          maxLength={30}
          autoComplete="off"
        />

        <button
          type="button"
          onClick={() => void share()}
          disabled={
            !canTransfer ||
            busy ||
            loading ||
            Boolean(error) ||
            selected.length === 0
          }
        >
          {busy
            ? text("Отправка…", "Sending…")
            : text("Поделиться", "Share")}
        </button>
      </div>

      <div className="fx-cols">
        <div>
          <h3>{text("Получено", "Received")}</h3>
          <ul>
            {incoming.length === 0 ? (
              <li>{text("Пока нет переводов", "No transfers yet")}</li>
            ) : (
              incoming.map((entry) => (
                <li key={entry.id}>
                  {entry.fromUsername}: {entry.amount.toFixed(2)} —{" "}
                  {formatDate(entry.createdAt)};{" "}
                  {text("действует до", "expires at")}{" "}
                  {formatDate(entry.expiresAt)}
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3>{text("Отправлено", "Sent")}</h3>
          <ul>
            {outgoing.length === 0 ? (
              <li>{text("Пока нет переводов", "No transfers yet")}</li>
            ) : (
              outgoing.map((entry) => (
                <li key={entry.id}>
                  {entry.toUsername}: {entry.amount.toFixed(2)} —{" "}
                  {formatDate(entry.createdAt)};{" "}
                  {text("действует до", "expires at")}{" "}
                  {formatDate(entry.expiresAt)}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}