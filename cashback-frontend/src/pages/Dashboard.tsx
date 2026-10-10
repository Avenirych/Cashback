import React, { useMemo, useState } from "react";
import { useBonuses } from "../context/BonusesContext";
import "./Dashboard.css";

type CashbackStatus = "pending" | "confirmed";
type PayoutStatus = "not_ready" | "ready" | "paid";

interface PurchaseRow {
  id: string;
  date: string; // DD.MM.YYYY
  product: string;
  appliedBonus: number;
  cashback: number;
  cashbackStatus: CashbackStatus;
  preparedToPayout: number;
  payoutStatus: PayoutStatus;
  payoutDate: string | null;
}

interface PayoutRow {
  id: string;
  date: string; // DD.MM.YYYY
  amount: number;
  purchaseIds: string[];
}

interface DashboardProps {
  lang: string;
}

function toDDMMYYYY(isoLike: string): string {
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export default function Dashboard({ lang }: DashboardProps) {
  const isRu = lang?.toUpperCase() === "RU";
  const { summary, items, transfers, loading, error } = useBonuses();

  // Временная история покупок/выплат, пока не подключён отдельный ledger endpoint.
  // Не удаляй, иначе снова пропадут таблицы операций.
  const [purchaseRows] = useState<PurchaseRow[]>([
    {
      id: "P-1001",
      date: "10.10.2026",
      product: "Sample Product #1",
      appliedBonus: 20,
      cashback: 10,
      cashbackStatus: "confirmed",
      preparedToPayout: 30,
      payoutStatus: "ready",
      payoutDate: null,
    },
    {
      id: "P-1002",
      date: "09.10.2026",
      product: "Sample Product #2",
      appliedBonus: 15,
      cashback: 8,
      cashbackStatus: "pending",
      preparedToPayout: 0,
      payoutStatus: "not_ready",
      payoutDate: null,
    },
  ]);

  const [payoutRows] = useState<PayoutRow[]>([
    {
      id: "W-1",
      date: "11.10.2026",
      amount: 30,
      purchaseIds: ["P-1001"],
    },
  ]);

  const t = {
    title: "Dashboard",
    currency: "GBP",

    summary: isRu
      ? "Сводка бонусов"
      : "Bonuses summary",

    totalConfirmed: isRu ? "Подтверждено" : "Confirmed",
    totalPending: isRu ? "Ожидает подтверждения" : "Pending",
    totalAvailable: isRu ? "Доступно" : "Available",
    totalSpent: isRu ? "Списано" : "Spent",
    totalExpired: isRu ? "Сгорело" : "Expired",

    open: isRu ? "Открыть" : "Open",
    close: isRu ? "Скрыть" : "Hide",

    onlyConfirmed: isRu ? "Только подтвержденные бонусы" : "Confirmed bonuses only",
    pendingSection: isRu ? "Ожидающие подтверждения бонусы" : "Bonuses awaiting confirmation",

    adsSectionTitle: isRu ? "Раздел: Бонусы за рекламу" : "Section: Ads bonuses",
    researchSectionTitle: isRu ? "Раздел: Бонусы за исследования" : "Section: Research bonuses",
    transfersSectionTitle: isRu ? "Раздел: Переводы бонусов" : "Section: Bonus transfers",
    opsSectionTitle: isRu ? "Раздел: Операции покупок и выплат" : "Section: Purchases & payouts operations",

    date: isRu ? "Дата" : "Date",
    expected: isRu ? "Ожидаемо" : "Expected",
    confirmed: isRu ? "Подтверждено" : "Confirmed",
    expiry: isRu ? "Срок действия" : "Expiry date",
    amount: isRu ? "Сумма" : "Amount",
    from: isRu ? "От кого" : "From",
    to: isRu ? "Кому" : "To",
    status: isRu ? "Статус" : "Status",
    source: isRu ? "Источник" : "Source",

    pId: isRu ? "Покупка" : "Purchase",
    pDate: isRu ? "Дата покупки" : "Purchase date",
    pProduct: isRu ? "Товар" : "Product",
    pApplied: isRu ? "Применено бонусов" : "Applied bonus",
    pCashback: isRu ? "Кэшбэк" : "Cashback",
    pCbStatus: isRu ? "Статус кэшбэка" : "Cashback status",
    pPrepared: isRu ? "В пул на вывод" : "Prepared to payout",
    pPayoutDate: isRu ? "Дата выведения" : "Payout date",

    wId: isRu ? "Выплата" : "Payout",
    wDate: isRu ? "Дата перевода" : "Transfer date",
    wAmount: isRu ? "Сумма" : "Amount",
    wItems: isRu ? "Покупки в батче" : "Purchases in batch",

    pendingStatus: isRu ? "ожидает" : "pending",
    confirmedStatus: isRu ? "подтвержден" : "confirmed",
    doneStatus: isRu ? "выполнен" : "done",

    ads: isRu ? "Реклама" : "Ads",
    research: isRu ? "Исследования" : "Research",
    transfer: isRu ? "Перевод" : "Transfer",
    other: isRu ? "Другое" : "Other",

    noData: isRu ? "Нет данных" : "No data",
    loading: isRu ? "Загрузка..." : "Loading...",
    dash: "—",
  };

  const sourceLabel = (source: string) => {
    if (source === "ads") return t.ads;
    if (source === "research") return t.research;
    if (source === "transfer") return t.transfer;
    return t.other;
  };

  const adsConfirmedRows = useMemo(
    () =>
      items.filter(
        (x) =>
          x.source === "ads" &&
          x.status === "confirmed" &&
          x.isExpired !== true
      ),
    [items]
  );

  const adsPendingRows = useMemo(
    () =>
      items.filter(
        (x) =>
          x.source === "ads" &&
          (x.status === "pending" || x.status === "failed")
      ),
    [items]
  );

  const researchConfirmedRows = useMemo(
    () =>
      items.filter(
        (x) =>
          x.source === "research" &&
          x.status === "confirmed" &&
          x.isExpired !== true
      ),
    [items]
  );

  const researchPendingRows = useMemo(
    () =>
      items.filter(
        (x) =>
          x.source === "research" &&
          (x.status === "pending" || x.status === "failed")
      ),
    [items]
  );

  const preparedPool = useMemo(
    () =>
      round2(
        purchaseRows
          .filter((p) => p.payoutStatus === "ready")
          .reduce((acc, p) => acc + p.preparedToPayout, 0)
      ),
    [purchaseRows]
  );

  const paidOutSum = useMemo(
    () =>
      round2(payoutRows.reduce((acc, p) => acc + p.amount, 0)),
    [payoutRows]
  );

  const [openAds, setOpenAds] = useState(true);
  const [openResearch, setOpenResearch] = useState(true);
  const [openTransfers, setOpenTransfers] = useState(true);
  const [openOps, setOpenOps] = useState(true);

  return (
    <main className="dashboard-page">
      <section className="dashboard-container">
        <h1 className="dashboard-title">{t.title}</h1>

        {loading && <p>{t.loading}</p>}
        {error && <p role="alert">{error}</p>}

        <div className="summary-box">
          <h2>{t.summary}</h2>
          <div className="summary-grid">
            <div className="sum-card">
              <p>{t.totalConfirmed}</p>
              <strong>
                {summary?.confirmed ?? 0} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.totalPending}</p>
              <strong>
                {summary?.pending ?? 0} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.totalAvailable}</p>
              <strong>
                {summary?.available ?? 0} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.totalSpent}</p>
              <strong>
                {summary?.spent ?? 0} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.totalExpired}</p>
              <strong>
                {summary?.expired ?? 0} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{isRu ? "Подготовлено к выплате" : "Prepared to payout"}</p>
              <strong>
                {preparedPool} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{isRu ? "Уже выплачено" : "Already paid out"}</p>
              <strong>
                {paidOutSum} {t.currency}
              </strong>
            </div>
          </div>
        </div>

        {/* ADS */}
        <section className="section-block">
          <div className="section-header">
            <h3>{t.adsSectionTitle}</h3>
            <button className="arrow-btn" onClick={() => setOpenAds((v) => !v)}>
              {openAds ? "▴" : "▾"} {openAds ? t.close : t.open}
            </button>
          </div>

          {openAds && (
            <>
              <h4>{t.onlyConfirmed}</h4>
              <div className="table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.confirmed}</th>
                      <th>{t.expiry}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsConfirmedRows.length === 0 ? (
                      <tr>
                        <td colSpan={3}>{t.noData}</td>
                      </tr>
                    ) : (
                      adsConfirmedRows.map((r) => (
                        <tr key={`ad-c-${r.id}`}>
                          <td>{toDDMMYYYY(r.createdAt)}</td>
                          <td>
                            {r.amount} {t.currency}
                          </td>
                          <td>{toDDMMYYYY(r.expiresAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h4>{t.pendingSection}</h4>
              <div className="table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.expected}</th>
                      <th>{t.confirmed}</th>
                      <th>{t.expiry}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adsPendingRows.length === 0 ? (
                      <tr>
                        <td colSpan={4}>{t.noData}</td>
                      </tr>
                    ) : (
                      adsPendingRows.map((r) => (
                        <tr key={`ad-p-${r.id}`}>
                          <td>{toDDMMYYYY(r.createdAt)}</td>
                          <td>
                            {r.amount} {t.currency}
                          </td>
                          <td>
                            {r.status === "confirmed" ? `${r.amount} ${t.currency}` : `0 ${t.currency}`}
                          </td>
                          <td>{toDDMMYYYY(r.expiresAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* RESEARCH */}
        <section className="section-block">
          <div className="section-header">
            <h3>{t.researchSectionTitle}</h3>
            <button className="arrow-btn" onClick={() => setOpenResearch((v) => !v)}>
              {openResearch ? "▴" : "▾"} {openResearch ? t.close : t.open}
            </button>
          </div>

          {openResearch && (
            <>
              <h4>{t.onlyConfirmed}</h4>
              <div className="table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.source}</th>
                      <th>{t.confirmed}</th>
                      <th>{t.expiry}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {researchConfirmedRows.length === 0 ? (
                      <tr>
                        <td colSpan={4}>{t.noData}</td>
                      </tr>
                    ) : (
                      researchConfirmedRows.map((r) => (
                        <tr key={`rs-c-${r.id}`}>
                          <td>{toDDMMYYYY(r.createdAt)}</td>
                          <td>{sourceLabel(r.source)}</td>
                          <td>
                            {r.amount} {t.currency}
                          </td>
                          <td>{toDDMMYYYY(r.expiresAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h4>{t.pendingSection}</h4>
              <div className="table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>{t.date}</th>
                      <th>{t.source}</th>
                      <th>{t.expected}</th>
                      <th>{t.confirmed}</th>
                      <th>{t.expiry}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {researchPendingRows.length === 0 ? (
                      <tr>
                        <td colSpan={5}>{t.noData}</td>
                      </tr>
                    ) : (
                      researchPendingRows.map((r) => (
                        <tr key={`rs-p-${r.id}`}>
                          <td>{toDDMMYYYY(r.createdAt)}</td>
                          <td>{sourceLabel(r.source)}</td>
                          <td>
                            {r.amount} {t.currency}
                          </td>
                          <td>0 {t.currency}</td>
                          <td>{toDDMMYYYY(r.expiresAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* TRANSFERS */}
        <section className="section-block">
          <div className="section-header">
            <h3>{t.transfersSectionTitle}</h3>
            <button className="arrow-btn" onClick={() => setOpenTransfers((v) => !v)}>
              {openTransfers ? "▴" : "▾"} {openTransfers ? t.close : t.open}
            </button>
          </div>

          {openTransfers && (
            <div className="table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t.date}</th>
                    <th>{t.from}</th>
                    <th>{t.to}</th>
                    <th>{t.amount}</th>
                    <th>{t.expiry}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>{t.noData}</td>
                    </tr>
                  ) : (
                    transfers.map((tr) => (
                      <tr key={tr.id}>
                        <td>{tr.id}</td>
                        <td>{toDDMMYYYY(tr.createdAt)}</td>
                        <td>{tr.fromUsername}</td>
                        <td>{tr.toUsername}</td>
                        <td>
                          {tr.amount} {t.currency}
                        </td>
                        <td>{toDDMMYYYY(tr.expiresAt)}</td>
                        <td>
                          {tr.status === "completed" ? t.doneStatus : t.pendingStatus}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* OPERATIONS */}
        <section className="section-block">
          <div className="section-header">
            <h3>{t.opsSectionTitle}</h3>
            <button className="arrow-btn" onClick={() => setOpenOps((v) => !v)}>
              {openOps ? "▴" : "▾"} {openOps ? t.close : t.open}
            </button>
          </div>

          {openOps && (
            <>
              <h4>{isRu ? "Покупки" : "Purchases"}</h4>
              <div className="table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>{t.pId}</th>
                      <th>{t.pDate}</th>
                      <th>{t.pProduct}</th>
                      <th>{t.pApplied}</th>
                      <th>{t.pCashback}</th>
                      <th>{t.pCbStatus}</th>
                      <th>{t.pPrepared}</th>
                      <th>{t.pPayoutDate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRows.length === 0 ? (
                      <tr>
                        <td colSpan={8}>{t.noData}</td>
                      </tr>
                    ) : (
                      purchaseRows.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.date}</td>
                          <td>{p.product}</td>
                          <td>
                            {p.appliedBonus} {t.currency}
                          </td>
                          <td>
                            {p.cashback} {t.currency}
                          </td>
                          <td>
                            {p.cashbackStatus === "confirmed"
                              ? t.confirmedStatus
                              : t.pendingStatus}
                          </td>
                          <td>
                            {p.preparedToPayout} {t.currency}
                          </td>
                          <td>{p.payoutDate ?? t.dash}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h4>{isRu ? "Автовыплаты" : "Auto payouts"}</h4>
              <div className="table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>{t.wId}</th>
                      <th>{t.wDate}</th>
                      <th>{t.wAmount}</th>
                      <th>{t.wItems}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRows.length === 0 ? (
                      <tr>
                        <td colSpan={4}>{t.noData}</td>
                      </tr>
                    ) : (
                      payoutRows.map((w) => (
                        <tr key={w.id}>
                          <td>{w.id}</td>
                          <td>{w.date}</td>
                          <td>
                            {w.amount} {t.currency}
                          </td>
                          <td>{w.purchaseIds.join(", ")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}