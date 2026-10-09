import React, { useMemo, useState } from "react";
import { translations } from "../i18n";
import "./ForumBonusExchangePanel.css";

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

interface ForumBonusExchangePanelProps {
  lang: string;
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

export default function ForumBonusExchangePanel({ lang }: ForumBonusExchangePanelProps) {
  const i18n = translations[lang.toUpperCase() as keyof typeof translations] ?? translations.EN;
  const isRu = lang.toUpperCase() === "RU";

  const tx = {
    title: isRu ? "Обмен бонусами между участниками" : "Bonus exchange between members",
    currentUser: isRu ? "Текущий пользователь:" : "Current user:",
    noBonuses: isRu ? "Нет доступных бонусов" : "No available bonuses",
    source: isRu ? "Источник" : "Source",
    amount: isRu ? "Бонусы" : "Amount",
    expiresAt: isRu ? "Действует до" : "Expires at",
    actions: isRu ? "Действия" : "Actions",
    apply: isRu ? "Применить" : "Apply",
    cancel: isRu ? "Отменить" : "Cancel",
    selected: isRu ? "Выбрано:" : "Selected:",
    receiverPlaceholder: isRu ? "username получателя" : "receiver username",
    share: isRu ? "Поделиться" : "Share",
    incoming: isRu ? "Получено" : "Received",
    outgoing: isRu ? "Отправлено" : "Sent",
    emptyIncoming: isRu ? "Пока нет" : "No records yet",
    invalidReceiver: isRu ? "Такой пользователь форума не найден" : "Forum user not found",
    emptyReceiver: isRu ? "Укажи имя получателя (username)" : "Enter receiver username",
    selfTransfer: isRu ? "Нельзя отправлять самому себе" : "You cannot transfer to yourself",
    nothingSelected: isRu ? "Выбери хотя бы один бонус для отправки" : "Select at least one bonus",
    from: isRu ? "от" : "from",
    until: isRu ? "до" : "until",
    sentTo: isRu ? "Кому" : "To",
    sentOn: isRu ? "Дата отправки" : "Sent at",
    receivedOn: isRu ? "Дата поступления" : "Received at",
    ads: isRu ? "Реклама" : "Ads",
    research: isRu ? "Исследования" : "Research",
    transfer: isRu ? "Перевод" : "Transfer",
    fromWhom: isRu ? "От кого" : "From",
  };

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
        .filter((b) => b.ownerUsername === activeUser && b.source === "transfer" && !b.used && !isExpired(b.expiresAt))
        .sort(sortByExpiryAsc),
    [allBonuses, activeUser]
  );

  const outgoingByMe = useMemo(
    () => logs.filter((l) => l.from === activeUser),
    [logs, activeUser]
  );

  const sourceLabel = (s: BonusSource) => {
    if (s === "ads") return tx.ads;
    if (s === "research") return tx.research;
    return tx.transfer;
  };

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

    if (!to) return alert(tx.emptyReceiver);
    if (to === activeUser) return alert(tx.selfTransfer);
    if (!USERS.includes(to)) return alert(tx.invalidReceiver);
    if (mySelected.length === 0) return alert(tx.nothingSelected);

    const selectedSet = new Set(selectedIds);

    const updated = allBonuses.map((b) =>
      selectedSet.has(b.id) && b.ownerUsername === activeUser ? { ...b, used: true } : b
    );

    const now = formatDate(new Date());

    const transferred: BonusItem[] = mySelected.map((src) => ({
      id: uid("TR"),
      ownerUsername: to,
      source: "transfer",
      amount: src.amount,
      expiresAt: src.expiresAt,
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
  };

  return (
    <section className="fx-panel">
      <h2>{tx.title}</h2>

      <div className="fx-row">
        <label>{tx.currentUser}</label>
        <select
          value={activeUser}
          onChange={(e) => {
            setActiveUser(e.target.value);
            setSelectedIds([]);
          }}
        >
          {USERS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      <div className="fx-table-wrap">
        <table className="fx-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{tx.source}</th>
              <th>{tx.amount}</th>
              <th>{tx.expiresAt}</th>
              <th>{tx.actions}</th>
            </tr>
          </thead>
          <tbody>
            {myAvailable.length === 0 ? (
              <tr>
                <td colSpan={5}>{tx.noBonuses}</td>
              </tr>
            ) : (
              myAvailable.map((b) => {
                const selected = selectedIds.includes(b.id);
                return (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td>{sourceLabel(b.source)}</td>
                    <td>{b.amount}</td>
                    <td>{b.expiresAt}</td>
                    <td className="fx-actions">
                      <button onClick={() => toggleSelect(b.id, true)} disabled={selected}>
                        {tx.apply}
                      </button>
                      <button onClick={() => toggleSelect(b.id, false)} disabled={!selected}>
                        {tx.cancel}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="fx-share">
        <div>
          {tx.selected} <strong>{selectedSum}</strong>
        </div>
        <input
          type="text"
          placeholder={tx.receiverPlaceholder}
          value={receiver}
          onChange={(e) => setReceiver(e.target.value)}
        />
        <button onClick={onShare}>{tx.share}</button>
      </div>

      <div className="fx-cols">
        <div>
          <h3>
            {tx.incoming} ({activeUser})
          </h3>
          <ul>
            {incomingForMe.length === 0 ? (
              <li>{tx.emptyIncoming}</li>
            ) : (
              incomingForMe.map((x) => (
                <li key={x.id}>
                  {tx.from} {x.transferMeta?.fromUsername} — {x.amount} ({tx.until} {x.expiresAt}), {tx.receivedOn}:{" "}
                  {x.createdAt}
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3>
            {tx.outgoing} ({activeUser})
          </h3>
          <ul>
            {outgoingByMe.length === 0 ? (
              <li>{tx.emptyIncoming}</li>
            ) : (
              outgoingByMe.map((x) => (
                <li key={x.id}>
                  {tx.sentTo}: {x.to}, {tx.amount}: {x.amount}, {tx.until} {x.expiresAt}, {tx.sentOn}: {x.createdAt}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}