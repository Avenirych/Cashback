import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Shop.css";

type SortMode = "bestPrice" | "bestDiscount" | "bestCashback" | "bestDeal";
type Seller = "A" | "B" | "C" | "D" | "E";
type BonusSource = "ads" | "research";

interface ProductItem {
  id: number;
  title: string;
  category: string;
  seller: Seller;
  basePrice: number;
  discountPercent: number;
  cashbackPercent: number;
  qualityScore: number;
  popularityScore: number;
  deliveryScore: number;
  image: string;
}

interface ComputedProduct extends ProductItem {
  discounted: number;
  cashbackAmount: number;
  appliedBonus: number;
  effectivePrice: number;
  dealScore: number;
}

interface BonusPosition {
  id: string;
  source: BonusSource;
  confirmedAmount: number;
  expiresAt: string;
  used: boolean;
}

interface ShopProps {
  lang: string;
}

const PRODUCT_IMAGE = "/assets/product-sample.png";
const USER_BONUS_BALANCE = 240;

const CATEGORY_OPTIONS = [
  "Books",
  "Films, TV, Music & Games",
  "Electronics & Computers",
  "Home, Garden & DIY",
  "Toys, Children & Baby",
  "Clothes, Shoes & Watches",
  "Sports & Outdoors",
  "Food & Grocery",
  "Health & Beauty",
  "Car & Motorbike",
  "Business, Industry & Science",
];

function createRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function intInRange(rand: () => number, min: number, max: number) {
  return min + Math.floor(rand() * (max - min + 1));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function percentileRank(sortedAsc: number[], value: number): number {
  if (sortedAsc.length <= 1) return 100;

  let index = 0;
  while (index < sortedAsc.length && sortedAsc[index] <= value) {
    index += 1;
  }

  const rank = index - 1;

  return Math.max(
    0,
    Math.min(100, (rank / (sortedAsc.length - 1)) * 100)
  );
}

function parseDate(s: string): Date {
  const [dd, mm, yyyy] = s.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function isExpired(s: string): boolean {
  const d = parseDate(s);
  const today = new Date();

  const t = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  const x = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  ).getTime();

  return x < t;
}

function buildSeedProducts(count = 100): ProductItem[] {
  const rand = createRandom(20261009);
  const sellers: Seller[] = ["A", "B", "C", "D", "E"];

  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;

    const category =
      CATEGORY_OPTIONS[
        intInRange(rand, 0, CATEGORY_OPTIONS.length - 1)
      ];

    const seller = sellers[i % sellers.length];

    return {
      id,
      title: `Sample Product #${id}`,
      category,
      seller,
      basePrice: intInRange(rand, 100, 200),
      discountPercent: intInRange(rand, 3, 20),
      cashbackPercent: intInRange(rand, 5, 15),
      qualityScore: intInRange(rand, 50, 100),
      popularityScore: intInRange(rand, 35, 100),
      deliveryScore: intInRange(rand, 40, 100),
      image: PRODUCT_IMAGE,
    };
  });
}

function buildBonusPool(): BonusPosition[] {
  return [
    {
      id: "AD-1001",
      source: "ads",
      confirmedAmount: 18,
      expiresAt: "29.10.2026",
      used: false,
    },
    {
      id: "AD-1002",
      source: "ads",
      confirmedAmount: 25,
      expiresAt: "22.10.2026",
      used: false,
    },
    {
      id: "AD-1003",
      source: "ads",
      confirmedAmount: 12,
      expiresAt: "10.10.2026",
      used: false,
    },
    {
      id: "AD-1004",
      source: "ads",
      confirmedAmount: 20,
      expiresAt: "05.10.2026",
      used: true,
    },
    {
      id: "RS-2001",
      source: "research",
      confirmedAmount: 30,
      expiresAt: "31.10.2026",
      used: false,
    },
    {
      id: "RS-2002",
      source: "research",
      confirmedAmount: 16,
      expiresAt: "19.10.2026",
      used: false,
    },
    {
      id: "RS-2003",
      source: "research",
      confirmedAmount: 14,
      expiresAt: "02.10.2026",
      used: true,
    },
    {
      id: "RS-2004",
      source: "research",
      confirmedAmount: 28,
      expiresAt: "26.10.2026",
      used: false,
    },
  ];
}

export default function Shop({ lang }: ShopProps) {
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();

  const [products] = useState<ProductItem[]>(
    () => buildSeedProducts(100)
  );

  const [bonusPool] = useState<BonusPosition[]>(
    () => buildBonusPool()
  );

  const [selectedCategory, setSelectedCategory] =
    useState<string>("All categories");

  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("bestDeal");
  const [infoOpen, setInfoOpen] = useState(false);

  const [selectedBonusIds, setSelectedBonusIds] =
    useState<string[]>([]);

  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const t = useMemo(() => {
    const isRu = lang.toUpperCase() === "RU";

    return {
      title: isRu ? "Магазин (Демо)" : "Shop (Demo)",
      balance: isRu
        ? "На вашем счету бонусов"
        : "Your bonus balance",
      spendBtn: isRu
        ? "Хочу потратить на покупку бонусов"
        : "I want to spend bonuses on purchase",
      spendInfoTitle: isRu
        ? "Правило применения бонусов"
        : "Bonus usage rule",
      spendInfoText: isRu
        ? "Покупатель может добавить такое количество бонусов, чтобы их количество вместе с кэшбэком не превышала цену товара."
        : "A buyer can apply only such bonus amount that together with cashback does not exceed product price.",
      categories: isRu ? "Категории" : "Categories",
      allCategories: isRu ? "Все категории" : "All categories",
      search: isRu ? "Поиск" : "Search",
      searchPlaceholder: isRu ? "Поиск товара..." : "Search product...",
      sortLabel: isRu ? "Сортировать" : "Sort by",
      sortBestPrice: isRu ? "Лучшая цена" : "Best price",
      sortBestDiscount: isRu ? "Лучшая скидка" : "Best discount",
      sortBestCashback: isRu ? "Лучший кэшбэк" : "Best cashback",
      sortBestDeal: isRu
        ? "Самая выгодная покупка"
        : "Best overall deal",
      basePrice: isRu ? "Базовая цена" : "Base price",
      discount: isRu ? "Скидка" : "Discount",
      cashback: isRu ? "Кэшбэк" : "Cashback",
      applyBonus: isRu ? "Бонусы к применению" : "Bonuses to apply",
      actualCashback: isRu ? "Кэшбэк факт" : "Cashback fact",
      finalAfterReturn: isRu ? "После возврата" : "After return",
      buy: isRu ? "Купить" : "Buy",
      waiting: isRu ? "Подождите..." : "Please wait...",
      noResults: isRu ? "Ничего не найдено" : "No results",
      better: isRu ? "лучше среднего" : "above average",
      worse: isRu ? "хуже среднего" : "below average",
      level: isRu ? "уровень" : "level",
      seller: isRu ? "Продавец" : "Seller",
      detailsOpen: isRu ? "Показать детали" : "Show details",
      detailsClose: isRu ? "Скрыть детали" : "Hide details",
      modalTitle: isRu
        ? "Доступные подтвержденные бонусы (реклама + исследования)"
        : "Available confirmed bonuses (ads + research)",
      source: isRu ? "Источник" : "Source",
      amount: isRu ? "Количество" : "Amount",
      expiry: isRu ? "Действует до" : "Expires at",
      actions: isRu ? "Действия" : "Actions",
      apply: isRu ? "Применить" : "Apply",
      cancel: isRu ? "Отменить" : "Cancel",
      ads: isRu ? "Реклама" : "Ads",
      research: isRu ? "Исследования" : "Research",
      emptyBonus: isRu
        ? "Нет доступных подтвержденных бонусов"
        : "No available confirmed bonuses",
      selectedSum: isRu ? "Выбрано бонусов" : "Selected bonus sum",
      close: isRu ? "Закрыть" : "Close",
    };
  }, [lang]);

  const onBuyClick = (item: ComputedProduct) => {
    if (authLoading) return;

    if (!user || !token || !user.email_verified) {
      const returnPath = `/shop?product=${item.id}`;

      navigate(
        `/register?next=${encodeURIComponent(returnPath)}`
      );
      return;
    }

    navigate("/partner-not-connected");
  };

  const availableBonusRows = useMemo(() => {
    return bonusPool
      .filter((b) => !b.used)
      .filter((b) => !isExpired(b.expiresAt))
      .sort(
        (a, b) =>
          parseDate(a.expiresAt).getTime() -
          parseDate(b.expiresAt).getTime()
      );
  }, [bonusPool]);

  const selectedBonusSumRaw = useMemo(() => {
    const set = new Set(selectedBonusIds);

    return round2(
      availableBonusRows
        .filter((b) => set.has(b.id))
        .reduce((acc, b) => acc + b.confirmedAmount, 0)
    );
  }, [availableBonusRows, selectedBonusIds]);

  const filteredBase = useMemo(() => {
    const categoryValue =
      selectedCategory === "All categories"
        ? null
        : selectedCategory;

    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((p) => {
      const byCategory = categoryValue
        ? p.category === categoryValue
        : true;

      const byQuery =
        normalizedQuery.length === 0 ||
        p.title.toLowerCase().includes(normalizedQuery) ||
        p.category.toLowerCase().includes(normalizedQuery) ||
        p.seller.toLowerCase().includes(normalizedQuery);

      return byCategory && byQuery;
    });
  }, [products, selectedCategory, query]);

  const computed = useMemo<ComputedProduct[]>(() => {
    return filteredBase.map((p) => {
      const discounted = round2(
        p.basePrice * (1 - p.discountPercent / 100)
      );

      const cashbackAmount = round2(
        discounted * (p.cashbackPercent / 100)
      );

      const maxBonusAllowedByRule = Math.max(
        0,
        Math.floor(discounted - cashbackAmount)
      );

      const appliedBonus = Math.min(
        selectedBonusSumRaw,
        USER_BONUS_BALANCE,
        maxBonusAllowedByRule
      );

      const effectivePrice = round2(
        discounted - cashbackAmount - appliedBonus
      );

      const dealScore =
        effectivePrice -
        p.discountPercent * 0.6 -
        p.cashbackPercent * 0.8;

      return {
        ...p,
        discounted,
        cashbackAmount,
        appliedBonus,
        effectivePrice,
        dealScore,
      };
    });
  }, [filteredBase, selectedBonusSumRaw]);

  const averages = useMemo(() => {
    if (computed.length === 0) {
      return { price: 0, discount: 0, cashback: 0, deal: 0 };
    }

    const sum = computed.reduce(
      (acc, p) => {
        acc.price += p.effectivePrice;
        acc.discount += p.discountPercent;
        acc.cashback += p.cashbackPercent;
        acc.deal += p.dealScore;
        return acc;
      },
      { price: 0, discount: 0, cashback: 0, deal: 0 }
    );

    return {
      price: sum.price / computed.length,
      discount: sum.discount / computed.length,
      cashback: sum.cashback / computed.length,
      deal: sum.deal / computed.length,
    };
  }, [computed]);

  const sorted = useMemo(() => {
    const arr = [...computed];

    arr.sort((a, b) => {
      switch (sortMode) {
        case "bestPrice":
          return a.effectivePrice - b.effectivePrice;
        case "bestDiscount":
          return b.discountPercent - a.discountPercent;
        case "bestCashback":
          return b.cashbackPercent - a.cashbackPercent;
        case "bestDeal":
        default:
          return a.dealScore - b.dealScore;
      }
    });

    return arr;
  }, [computed, sortMode]);

  const distributions = useMemo(() => {
    const prices = computed
      .map((x) => x.effectivePrice)
      .sort((a, b) => a - b);

    const discounts = computed
      .map((x) => x.discountPercent)
      .sort((a, b) => a - b);

    const cashbacks = computed
      .map((x) => x.cashbackPercent)
      .sort((a, b) => a - b);

    const deals = computed
      .map((x) => x.dealScore)
      .sort((a, b) => a - b);

    return { prices, discounts, cashbacks, deals };
  }, [computed]);

  const levelsFor = (item: ComputedProduct) => {
    const price = Math.round(
      100 -
        percentileRank(distributions.prices, item.effectivePrice)
    );

    const discount = Math.round(
      percentileRank(
        distributions.discounts,
        item.discountPercent
      )
    );

    const cashback = Math.round(
      percentileRank(
        distributions.cashbacks,
        item.cashbackPercent
      )
    );

    const deal = Math.round(
      100 - percentileRank(distributions.deals, item.dealScore)
    );

    return { price, discount, cashback, deal };
  };

  const selectedMetricKey =
    sortMode === "bestPrice"
      ? "price"
      : sortMode === "bestDiscount"
      ? "discount"
      : sortMode === "bestCashback"
      ? "cashback"
      : "deal";

  const selectedMetricLabel =
    sortMode === "bestPrice"
      ? t.sortBestPrice
      : sortMode === "bestDiscount"
      ? t.sortBestDiscount
      : sortMode === "bestCashback"
      ? t.sortBestCashback
      : t.sortBestDeal;

  const toggleBonus = (id: string, on: boolean) => {
    setSelectedBonusIds((prev) => {
      const set = new Set(prev);

      if (on) set.add(id);
      else set.delete(id);

      return Array.from(set);
    });
  };

  return (
    <main className="shop-page">
      <section className="shop-container">
        <header className="shop-header">
          <div className="shop-title-wrap">
            <h1>{t.title}</h1>

            <div className="shop-balance-line">
              {t.balance}: <strong>{USER_BONUS_BALANCE}</strong>
            </div>
          </div>

          <button
            type="button"
            className="shop-bonus-btn"
            onClick={() => setInfoOpen(true)}
          >
            {t.spendBtn}
          </button>
        </header>

        {infoOpen && (
          <div
            className="shop-modal-overlay"
            onClick={() => setInfoOpen(false)}
          >
            <div
              className="shop-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{t.spendInfoTitle}</h2>
              <p>{t.spendInfoText}</p>
            </div>
          </div>
        )}

        <section className="shop-toolbar">
          <div className="shop-control">
            <label>{t.categories}</label>

            <select
              value={selectedCategory}
              onChange={(e) =>
                setSelectedCategory(e.target.value)
              }
            >
              <option value="All categories">
                {t.allCategories}
              </option>

              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="shop-control">
            <label>{t.applyBonus}</label>

            <button
              type="button"
              className="bonus-input-like"
              onClick={() => setBonusModalOpen(true)}
              title={t.modalTitle}
            >
              {selectedBonusSumRaw} GBP
            </button>
          </div>

          <div className="shop-control shop-search">
            <label>{t.search}</label>

            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="shop-control">
            <label>{t.sortLabel}</label>

            <select
              value={sortMode}
              onChange={(e) =>
                setSortMode(e.target.value as SortMode)
              }
            >
              <option value="bestPrice">{t.sortBestPrice}</option>
              <option value="bestDiscount">
                {t.sortBestDiscount}
              </option>
              <option value="bestCashback">
                {t.sortBestCashback}
              </option>
              <option value="bestDeal">{t.sortBestDeal}</option>
            </select>
          </div>
        </section>

        {bonusModalOpen && (
          <div
            className="shop-modal-overlay"
            onClick={() => setBonusModalOpen(false)}
          >
            <div
              className="shop-modal bonus-modal-wide"
              onClick={(e) => e.stopPropagation()}
            >
              <h2>{t.modalTitle}</h2>

              {availableBonusRows.length === 0 ? (
                <p>{t.emptyBonus}</p>
              ) : (
                <div className="bonus-table-wrap">
                  <table className="bonus-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>{t.source}</th>
                        <th>{t.amount}</th>
                        <th>{t.expiry}</th>
                        <th>{t.actions}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {availableBonusRows.map((row) => {
                        const selected =
                          selectedBonusIds.includes(row.id);

                        return (
                          <tr key={row.id}>
                            <td>{row.id}</td>
                            <td>
                              {row.source === "ads"
                                ? t.ads
                                : t.research}
                            </td>
                            <td>{row.confirmedAmount} GBP</td>
                            <td>{row.expiresAt}</td>

                            <td className="bonus-actions-cell">
                              <button
                                type="button"
                                className="mini-btn apply"
                                onClick={() =>
                                  toggleBonus(row.id, true)
                                }
                                disabled={selected}
                              >
                                {t.apply}
                              </button>

                              <button
                                type="button"
                                className="mini-btn cancel"
                                onClick={() =>
                                  toggleBonus(row.id, false)
                                }
                                disabled={!selected}
                              >
                                {t.cancel}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bonus-modal-footer">
                <div>
                  {t.selectedSum}:{" "}
                  <strong>{selectedBonusSumRaw} GBP</strong>
                </div>

                <button
                  type="button"
                  className="shop-bonus-btn"
                  onClick={() => setBonusModalOpen(false)}
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="shop-empty">{t.noResults}</p>
        ) : (
          <section className="shop-grid">
            {sorted.map((item) => {
              const lvl = levelsFor(item);

              const selectedValue =
                selectedMetricKey === "price"
                  ? lvl.price
                  : selectedMetricKey === "discount"
                  ? lvl.discount
                  : selectedMetricKey === "cashback"
                  ? lvl.cashback
                  : lvl.deal;

              const isAboveAvg =
                selectedMetricKey === "price"
                  ? item.effectivePrice <= averages.price
                  : selectedMetricKey === "discount"
                  ? item.discountPercent >= averages.discount
                  : selectedMetricKey === "cashback"
                  ? item.cashbackPercent >= averages.cashback
                  : item.dealScore <= averages.deal;

              const isExpanded = expandedId === item.id;

              return (
                <article
                  className="shop-card compact"
                  key={item.id}
                >
                  <div className="shop-card-image-wrap compact">
                    <span className="seller-badge">
                      {t.seller} {item.seller}
                    </span>
                    <img src={item.image} alt={item.title} />
                  </div>

                  <div className="shop-card-main compact">
                    <h3>{item.title}</h3>
                    <p className="shop-category">{item.category}</p>

                    <div className="shop-stats compact">
                      <div>
                        {t.basePrice}:{" "}
                        <strong>{item.basePrice}</strong>
                      </div>
                      <div>
                        {t.discount}:{" "}
                        <strong>{item.discountPercent}%</strong>
                      </div>
                      <div>
                        {t.cashback}:{" "}
                        <strong>{item.cashbackPercent}%</strong>
                      </div>
                    </div>

                    <div className="shop-metrics compact">
                      <div className="metric-box">
                        <span>{t.applyBonus}</span>
                        <strong>{item.appliedBonus}</strong>
                      </div>

                      <div className="metric-box">
                        <span>{t.actualCashback}</span>
                        <strong>{item.cashbackAmount}</strong>
                      </div>

                      <div className="metric-box">
                        <span>{t.finalAfterReturn}</span>
                        <strong>{item.effectivePrice}</strong>
                      </div>
                    </div>

                    <div className="selected-bar-row">
                      <div className="selected-bar-title">
                        <span>
                          {selectedMetricLabel}: {selectedValue}% (
                          {t.level})
                        </span>

                        <small
                          className={
                            isAboveAvg ? "tag-good" : "tag-bad"
                          }
                        >
                          {isAboveAvg ? t.better : t.worse}
                        </small>
                      </div>

                      <div
                        className={`bar-track ${
                          selectedMetricKey === "deal"
                            ? "bar-track-deal"
                            : ""
                        }`}
                      >
                        <div
                          className={`bar-fill ${
                            selectedMetricKey === "deal"
                              ? "bar-deal-red"
                              : selectedMetricKey === "price"
                              ? "bar-1"
                              : selectedMetricKey === "discount"
                              ? "bar-2"
                              : "bar-3"
                          }`}
                          style={{
                            width: `${Math.max(12, selectedValue)}%`,
                            background:
                              selectedMetricKey === "deal"
                                ? "linear-gradient(90deg, #e1062c, #ff3b5f)"
                                : undefined,
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="details-toggle"
                      onClick={() =>
                        setExpandedId(
                          isExpanded ? null : item.id
                        )
                      }
                    >
                      {isExpanded
                        ? t.detailsClose
                        : t.detailsOpen}
                    </button>

                    {isExpanded && (
                      <div className="details-tray">
                        {selectedMetricKey !== "price" && (
                          <div className="bar-row compact-row">
                            <span>
                              {t.sortBestPrice}: {lvl.price}%
                            </span>
                            <div className="bar-track">
                              <div
                                className="bar-fill bar-1"
                                style={{
                                  width: `${Math.max(8, lvl.price)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {selectedMetricKey !== "discount" && (
                          <div className="bar-row compact-row">
                            <span>
                              {t.sortBestDiscount}: {lvl.discount}%
                            </span>
                            <div className="bar-track">
                              <div
                                className="bar-fill bar-2"
                                style={{
                                  width: `${Math.max(8, lvl.discount)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {selectedMetricKey !== "cashback" && (
                          <div className="bar-row compact-row">
                            <span>
                              {t.sortBestCashback}: {lvl.cashback}%
                            </span>
                            <div className="bar-track">
                              <div
                                className="bar-fill bar-3"
                                style={{
                                  width: `${Math.max(8, lvl.cashback)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {selectedMetricKey !== "deal" && (
                          <div className="bar-row compact-row">
                            <span>
                              {t.sortBestDeal}: {lvl.deal}%
                            </span>
                            <div className="bar-track bar-track-deal">
                              <div
                                className="bar-fill bar-deal-red"
                                style={{
                                  width: `${Math.max(12, lvl.deal)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      className="shop-buy-btn"
                      onClick={() => onBuyClick(item)}
                      disabled={authLoading}
                      aria-busy={authLoading}
                    >
                      {authLoading ? t.waiting : t.buy}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}