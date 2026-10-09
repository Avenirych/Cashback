import React, { useMemo, useState } from "react";
import "./ForumBonusExchange.css";

type BonusSource = "ads" | "research" | "transfer";

interface BonusItem {
  id: string;
  ownerUsername: string;
  source: BonusSource;
  amount: number;
  expiresAt: string; // DD.MM.YYYY
  used: boolean;
  createdAt: string; // DD.MM.YYYY
  transferMeta?: {
    fromUsername: string;
    toUsername: string;
  };
}

interface TransferLogRow {
  id: string;
  from: string;
  to: string;
  amount: number;
  expiresAt: string;
  createdAt: string;
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
function parseDate(s: string): Date {
  const [dd, mm, yyyy] = s.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd);
}
function isExpired(s: string): boolean {
  const x = parseDate(s);
  const now = new Date();
  const a = new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return a < b;
}
function sortByExpiryAsc(a: BonusItem, b: BonusItem) {
  return parseDate(a.expiresAt).getTime() - parseDate(b.expiresAt).getTime();
}
function uid(prefix = "ID") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const USERS = ["alice", "bob", "charlie", "diana"];

function seedBonuses(): BonusItem[] {
  return [
    { id: "B-1", ownerUsername: "alice", source: "ads", amount: 18, expiresAt: "29.10.2026", used: false, createdAt: "01.10.2026" },
    { id: "B-2", ownerUsername: "alice", source: "research", amount: 26, expiresAt: "24.10.2026", used: false, createdAt: "02.10.2026" },
    { id: "B-3", ownerUsername: "alice", source: "ads", amount: 12, expiresAt: "18.10.2026", used: false, createdAt: "03.10.2026" },

    { id: "B-4", ownerUsername: "bob", source: "research", amount: 34, expiresAt: "31.10.2026", used: false, createdAt: "04.10.2026" },
    { id: "B-5", ownerUsername: "bob", source: "ads", amount: 9, expiresAt: "22.10.2026", used: false, createdAt: "04.10.2026" },

    { id: "B-6", ownerUsername: "charlie", source: "ads", amount: 15, expiresAt: "27.10.2026", used: false, createdAt: "06.10.2026" },
    { id: "B-7", ownerUsername: "diana", source: "research", amount: 21, expiresAt: "25.10.2026", used: false, createdAt: "07.10.2026" },
  ];
}

export default function ForumBonusExchange() {
  const [activeUser, setActiveUser] = useState<string>("alice");
  const [allBonuses, setAllBonuses] = useState<BonusItem[]>(seedBonuses);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [receiver, setReceiver] = useState<string>("");
  const [logs, setLogs] = useState<TransferLogRow[]>([]);

  const myAvailable = useMemo(
    () =>
      allBonuses
        .filter((b) => b.ownerUsername === activeUser && !b.used && !isExpired(b.expiresAt))
        .sort(sortByExpiryAsc),
    [allBonuses, activeUser]
  );

  const mySelected = useMemo(
    () => myAvailable.filter((b) => selectedIds.includes(b.id)),
    [myAvailable, selectedIds]
  );

  const selectedSum = useMemo(
    () => mySelected.reduce((acc, b) => acc + b.amount, 0),
    [mySelected]
  );

  const incomingForMe = useMemo(
    () =>
      allBonuses
        .filter(
          (b) =>
            b.ownerUsername === activeUser &&
            b.source === "transfer" &&
            !b.used &&
            !isExpired(b.expiresAt)
        )
        .sort(sortByExpiryAsc),
    [allBonuses, activeUser]
  );

  const outgoingByMe = useMemo(
    () => logs.filter((l) => l.from === activeUser),
    [logs, activeUser]
  );

  const toggleSelect = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (on) s.add(id);
      else s.delete(id);
      return Array.from(s);
    });
  };

  const onShare = () => {
    const to = receiver.trim().toLowerCase();
    if (!to) return alert("Укажи имя получателя (username)");
    if (to === activeUser) return alert("Нельзя отправлять самому себе");
    if (!USERS.includes(to)) return alert("Такой пользователь форума не найден");
    if (mySelected.length === 0) return alert("Выбери хотя бы один бонус для отправки");

    // 1) Списываем выбранные бонусы у отправителя (делаем used=true)
    const selectedSet = new Set(selectedIds);
    const updated = allBonuses.map((b) =>
      selectedSet.has(b.id) && b.ownerUsername === activeUser ? { ...b, used: true } : b
    );

    // 2) Создаем у получателя новые позиции в "доступных для использования бонусах"
    // с теми же expiry, чтобы встали в календарную логику.
    const now = formatDate(new Date());
    const transferred: BonusItem[] = mySelected.map((src) => ({
      id: uid("TR"),
      ownerUsername: to,
      source: "transfer",
      amount: src.amount,
      expiresAt: src.expiresAt, // календарный срок сохраняем
      used: false,
      createdAt: now,
      transferMeta: { fromUsername: activeUser, toUsername: to },
    }));

    const newLogs: TransferLogRow[] = mySelected.map((src) => ({
      id: uid("LOG"),
      from: activeUser,
      to,
      amount: src.amount,
      expiresAt: src.expiresAt,
      createdAt: now,
    }));

    setAllBonuses([...updated, ...transferred]);
    setLogs((prev) => [...newLogs, ...prev]);
    setSelectedIds([]);
    setReceiver("");
    alert(`Отправлено: ${selectedSum} бонусов пользователю ${to}`);
  };

  return (
    <main className="forum-bonus-page">
      <section className="forum-bonus-container">
        <h1>Форум — обмен бонусами</h1>

        <div className="panel">
          <label>Текущий пользователь форума</label>
          <select value={activeUser} onChange={(e) => { setActiveUser(e.target.value); setSelectedIds([]); }}>
            {USERS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="panel">
          <h2>Доступные для использования бонусы ({activeUser})</h2>
          <p className="muted">
            Только неиспользованные и неистекшие. Сортировка по ближайшему сроку окончания.
          </p>

          <div className="table-wrap">
            <table className="bonus-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Источник</th>
                  <th>Количество</th>
                  <th>Действует до</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {myAvailable.length === 0 ? (
                  <tr><td colSpan={5}>Нет доступных бонусов</td></tr>
                ) : (
                  myAvailable.map((b) => {
                    const selected = selectedIds.includes(b.id);
                    return (
                      <tr key={b.id}>
                        <td>{b.id}</td>
                        <td>{b.source}</td>
                        <td>{b.amount}</td>
                        <td>{b.expiresAt}</td>
                        <td className="actions-cell">
                          <button className="btn-mini apply" onClick={() => toggleSelect(b.id, true)} disabled={selected}>
                            Применить
                          </button>
                          <button className="btn-mini cancel" onClick={() => toggleSelect(b.id, false)} disabled={!selected}>
                            Отменить
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="selected-row">
            <span>Выбрано для отправки: <strong>{selectedSum}</strong></span>
          </div>
        </div>

        <div className="panel">
          <h2>Поделиться бонусами</h2>
          <div className="share-row">
            <input
              type="text"
              placeholder="Имя получателя (username форума)"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
            />
            <button className="btn-share" onClick={onShare}>Поделиться</button>
          </div>
        </div>

        <div className="panel">
          <h2>Полученные бонусы ({activeUser})</h2>
          <div className="table-wrap">
            <table className="bonus-table">
              <thead>
                <tr>
                  <th>От кого</th>
                  <th>Количество</th>
                  <th>Действует до</th>
                  <th>Дата поступления</th>
                </tr>
              </thead>
              <tbody>
                {incomingForMe.length === 0 ? (
                  <tr><td colSpan={4}>Пока нет входящих переводов</td></tr>
                ) : (
                  incomingForMe.map((b) => (
                    <tr key={b.id}>
                      <td>{b.transferMeta?.fromUsername ?? "-"}</td>
                      <td>{b.amount}</td>
                      <td>{b.expiresAt}</td>
                      <td>{b.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <h2>История отправок ({activeUser})</h2>
          <div className="table-wrap">
            <table className="bonus-table">
              <thead>
                <tr>
                  <th>Кому</th>
                  <th>Количество</th>
                  <th>Срок бонуса</th>
                  <th>Дата отправки</th>
                </tr>
              </thead>
              <tbody>
                {outgoingByMe.length === 0 ? (
                  <tr><td colSpan={4}>Пока нет исходящих переводов</td></tr>
                ) : (
                  outgoingByMe.map((l) => (
                    <tr key={l.id}>
                      <td>{l.to}</td>
                      <td>{l.amount}</td>
                      <td>{l.expiresAt}</td>
                      <td>{l.createdAt}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}