import React, { useMemo, useState } from "react";
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
  preparedToPayout: number; // 0 until cashback confirmed; then applied+cashback
  payoutStatus: PayoutStatus;
  payoutDate: string | null;
}

interface PayoutRow {
  id: string;
  date: string; // DD.MM.YYYY
  amount: number;
  purchaseIds: string[];
}

interface AdBonusRow {
  id: string;
  viewDate: string; // DD.MM.YYYY
  expectedBonus: number;
  confirmedBonus: number;
  expiresAt: string; // DD.MM.YYYY
}

interface ResearchBonusRow {
  id: string;
  startDate: string; // DD.MM.YYYY
  topic: string;
  expectedBonus: number;
  confirmedBonus: number;
  expiresAt: string; // DD.MM.YYYY
}

interface DashboardProps {
  lang: string;
}

function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const intInRange = (r: () => number, min: number, max: number) =>
  min + Math.floor(r() * (max - min + 1));

const round2 = (n: number) => Math.round(n * 100) / 100;

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function parseDDMMYYYY(s: string): Date {
  const [dd, mm, yyyy] = s.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * История бонусов за рекламу (1 месяц), даты сверху последние.
 * Правило срока годности: +30 дней с даты подтверждения/начисления.
 */
function generateAdHistory(count = 20): AdBonusRow[] {
  const rand = createRandom(555001);
  const now = new Date();
  const monthAgo = addDays(now, -30);

  const rows: AdBonusRow[] = Array.from({ length: count }, (_, i) => {
    const viewDate = addDays(monthAgo, intInRange(rand, 0, 29));
    const expected = round2(intInRange(rand, 4, 18));
    const isConfirmed = rand() > 0.2;
    const confirmed = isConfirmed ? expected : 0;
    const expiresAt = addDays(viewDate, 30);

    return {
      id: `AD-${i + 1}`,
      viewDate: formatDate(viewDate),
      expectedBonus: expected,
      confirmedBonus: confirmed,
      expiresAt: formatDate(expiresAt),
    };
  });

  return rows.sort(
    (a, b) => parseDDMMYYYY(b.viewDate).getTime() - parseDDMMYYYY(a.viewDate).getTime()
  );
}

/**
 * История бонусов за исследования (1 месяц), даты сверху последние.
 */
function generateResearchHistory(count = 14): ResearchBonusRow[] {
  const rand = createRandom(777331);
  const now = new Date();
  const monthAgo = addDays(now, -30);
  const topics = [
    "UI/UX Feedback",
    "Payment Experience",
    "Checkout Funnel",
    "Delivery Satisfaction",
    "Loyalty Program Survey",
    "Mobile App Usability",
    "Search Relevance",
    "Customer Support Quality",
    "Price Perception Study",
  ];

  const rows: ResearchBonusRow[] = Array.from({ length: count }, (_, i) => {
    const startDate = addDays(monthAgo, intInRange(rand, 0, 29));
    const expected = round2(intInRange(rand, 10, 35));
    const isConfirmed = rand() > 0.25;
    const confirmed = isConfirmed ? expected : 0;
    const topic = topics[intInRange(rand, 0, topics.length - 1)];
    const expiresAt = addDays(startDate, 30);

    return {
      id: `RS-${i + 1}`,
      startDate: formatDate(startDate),
      topic,
      expectedBonus: expected,
      confirmedBonus: confirmed,
      expiresAt: formatDate(expiresAt),
    };
  });

  return rows.sort(
    (a, b) => parseDDMMYYYY(b.startDate).getTime() - parseDDMMYYYY(a.startDate).getTime()
  );
}

/**
 * История покупок + авто-выплаты.
 * Правило:
 * - appliedBonus списан при покупке
 * - в prepared_to_payout попадает только когда cashback confirmed:
 *   prepared = appliedBonus + cashback
 * - авто-выплата, когда батч >= 100
 */
function generatePurchaseAndPayoutModel() {
  const rand = createRandom(20261009);
  const now = new Date();
  const monthAgo = addDays(now, -30);

  const purchases: PurchaseRow[] = Array.from(
    { length: 10 },
    (_, i): PurchaseRow => {
      const purchaseDate = addDays(monthAgo, intInRange(rand, 0, 27));
      const appliedBonus = round2(intInRange(rand, 10, 40));
      const cashback = round2(intInRange(rand, 5, 30));
      const cashbackConfirmed = rand() > 0.25;

      return {
        id: `P-${i + 1}`,
        date: formatDate(purchaseDate),
        product: `Sample Product #${intInRange(rand, 1, 120)}`,
        appliedBonus,
        cashback,
        cashbackStatus: cashbackConfirmed ? "confirmed" : "pending",
        preparedToPayout: 0,
        payoutStatus: "not_ready",
        payoutDate: null,
      };
    }
  ).sort(
    (a, b) =>
      parseDDMMYYYY(a.date).getTime() - parseDDMMYYYY(b.date).getTime()
  );

  // Формируем очередь готовых к выплате (только confirmed cashback)
  const readyQueue: PurchaseRow[] = [];
  for (const row of purchases) {
    if (row.cashbackStatus === "confirmed") {
      row.preparedToPayout = round2(row.appliedBonus + row.cashback);
      row.payoutStatus = "ready";
      readyQueue.push(row);
    }
  }

  const payouts: PayoutRow[] = [];
  let batch: PurchaseRow[] = [];
  let batchSum = 0;

  const flushBatch = (baseDate: Date) => {
    if (batch.length === 0) return;

    const payoutDate = formatDate(addDays(baseDate, 1));
    const payoutId = `W-${payouts.length + 1}`;

    payouts.push({
      id: payoutId,
      date: payoutDate,
      amount: round2(batchSum),
      purchaseIds: batch.map((x) => x.id),
    });

    for (const item of batch) {
      item.payoutStatus = "paid";
      item.payoutDate = payoutDate;
    }

    batch = [];
    batchSum = 0;
  };

  for (const row of readyQueue) {
    batch.push(row);
    batchSum = round2(batchSum + row.preparedToPayout);

    if (batchSum >= 100) {
      flushBatch(parseDDMMYYYY(row.date));
    }
  }

  // Сортировка на вывод: последние даты сверху
  const purchasesSorted = [...purchases].sort(
    (a, b) => parseDDMMYYYY(b.date).getTime() - parseDDMMYYYY(a.date).getTime()
  );
  const payoutsSorted = [...payouts].sort(
    (a, b) => parseDDMMYYYY(b.date).getTime() - parseDDMMYYYY(a.date).getTime()
  );

  return {
    purchases: purchasesSorted,
    payouts: payoutsSorted,
  };
}

export default function Dashboard({ lang }: DashboardProps) {
  const isRu = lang?.toUpperCase() === "RU";

  const t = {
    title: "Dashboard",
    currency: "GBP",

    summary: isRu
      ? "Сводка (только подтвержденные бонусы по разделам)"
      : "Summary (confirmed bonuses by section)",

    adConfirmed: isRu ? "Реклама: подтверждено" : "Ads: confirmed",
    researchConfirmed: isRu ? "Исследования: подтверждено" : "Research: confirmed",
    totalConfirmed: isRu ? "Итого подтверждено" : "Total confirmed",
    preparedPool: isRu
      ? "Подготовлено к автовыплате (покупки+cashback)"
      : "Prepared for auto payout (purchases+cashback)",
    paidOut: isRu ? "Уже выведено автоматически" : "Already auto-paid out",

    open: isRu ? "Открыть" : "Open",
    close: isRu ? "Скрыть" : "Hide",

    onlyConfirmed: isRu ? "Только подтвержденные бонусы" : "Confirmed bonuses only",
    pendingSection: isRu
      ? "Ожидающие подтверждения бонусы"
      : "Bonuses awaiting confirmation",

    adsSectionTitle: isRu
      ? "Раздел: Бонусы за рекламу"
      : "Section: Ads bonuses",

    researchSectionTitle: isRu
      ? "Раздел: Бонусы за исследования"
      : "Section: Research bonuses",

    opsSectionTitle: isRu
      ? "Раздел: Операции покупок и выплат"
      : "Section: Purchases & payouts operations",

    // Таблицы
    date: isRu ? "Дата" : "Date",
    expected: isRu ? "Ожидаемо" : "Expected",
    confirmed: isRu ? "Подтверждено" : "Confirmed",
    expiry: isRu ? "Срок действия" : "Expiry date",

    startDate: isRu ? "Дата старта" : "Start date",
    topic: isRu ? "Тема" : "Topic",

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

    noData: isRu ? "Нет данных" : "No data",
    dash: "—",
  };

  const adRows = useMemo(() => generateAdHistory(20), []);
  const researchRows = useMemo(() => generateResearchHistory(14), []);
  const model = useMemo(() => generatePurchaseAndPayoutModel(), []);

  // confirmed / pending разрезы
  const adConfirmedRows = adRows.filter((r) => r.confirmedBonus > 0);
  const adPendingRows = adRows.filter((r) => r.confirmedBonus === 0);

  const researchConfirmedRows = researchRows.filter((r) => r.confirmedBonus > 0);
  const researchPendingRows = researchRows.filter((r) => r.confirmedBonus === 0);

  // сводка
  const adConfirmedSum = round2(
    adConfirmedRows.reduce((acc, r) => acc + r.confirmedBonus, 0)
  );
  const researchConfirmedSum = round2(
    researchConfirmedRows.reduce((acc, r) => acc + r.confirmedBonus, 0)
  );
  const totalConfirmed = round2(adConfirmedSum + researchConfirmedSum);

  const preparedPool = round2(
    model.purchases
      .filter((p) => p.payoutStatus === "ready")
      .reduce((acc, p) => acc + p.preparedToPayout, 0)
  );

  const paidOutSum = round2(
    model.payouts.reduce((acc, p) => acc + p.amount, 0)
  );

  // треи
  const [openAds, setOpenAds] = useState(false);
  const [openResearch, setOpenResearch] = useState(false);
  const [openOps, setOpenOps] = useState(false);

  return (
    <main className="dashboard-page">
      <section className="dashboard-container">
        <h1 className="dashboard-title">{t.title}</h1>

        <div className="summary-box">
          <h2>{t.summary}</h2>
          <div className="summary-grid">
            <div className="sum-card">
              <p>{t.adConfirmed}</p>
              <strong>
                {adConfirmedSum} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.researchConfirmed}</p>
              <strong>
                {researchConfirmedSum} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.totalConfirmed}</p>
              <strong>
                {totalConfirmed} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.preparedPool}</p>
              <strong>
                {preparedPool} {t.currency}
              </strong>
            </div>

            <div className="sum-card">
              <p>{t.paidOut}</p>
              <strong>
                {paidOutSum} {t.currency}
              </strong>
            </div>
          </div>
        </div>

        {/* SECTION: ADS */}
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
                    {adConfirmedRows.length === 0 ? (
                      <tr>
                        <td colSpan={3}>{t.noData}</td>
                      </tr>
                    ) : (
                      adConfirmedRows.map((r) => (
                        <tr key={`ad-c-${r.id}`}>
                          <td>{r.viewDate}</td>
                          <td>
                            {r.confirmedBonus} {t.currency}
                          </td>
                          <td>{r.expiresAt}</td>
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
                    {adPendingRows.length === 0 ? (
                      <tr>
                        <td colSpan={4}>{t.noData}</td>
                      </tr>
                    ) : (
                      adPendingRows.map((r) => (
                        <tr key={`ad-p-${r.id}`}>
                          <td>{r.viewDate}</td>
                          <td>
                            {r.expectedBonus} {t.currency}
                          </td>
                          <td>
                            {r.confirmedBonus} {t.currency}
                          </td>
                          <td>{r.expiresAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* SECTION: RESEARCH */}
        <section className="section-block">
          <div className="section-header">
            <h3>{t.researchSectionTitle}</h3>
            <button
              className="arrow-btn"
              onClick={() => setOpenResearch((v) => !v)}
            >
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
                      <th>{t.startDate}</th>
                      <th>{t.topic}</th>
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
                          <td>{r.startDate}</td>
                          <td>{r.topic}</td>
                          <td>
                            {r.confirmedBonus} {t.currency}
                          </td>
                          <td>{r.expiresAt}</td>
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
                      <th>{t.startDate}</th>
                      <th>{t.topic}</th>
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
                          <td>{r.startDate}</td>
                          <td>{r.topic}</td>
                          <td>
                            {r.expectedBonus} {t.currency}
                          </td>
                          <td>
                            {r.confirmedBonus} {t.currency}
                          </td>
                          <td>{r.expiresAt}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* SECTION: OPERATIONS */}
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
                    {model.purchases.length === 0 ? (
                      <tr>
                        <td colSpan={8}>{t.noData}</td>
                      </tr>
                    ) : (
                      model.purchases.map((p) => (
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
                    {model.payouts.length === 0 ? (
                      <tr>
                        <td colSpan={4}>{t.noData}</td>
                      </tr>
                    ) : (
                      model.payouts.map((w) => (
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