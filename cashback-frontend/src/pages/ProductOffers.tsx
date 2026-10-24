import React, { useMemo } from "react";

type Seller = "A" | "B" | "C" | "D" | "E";

interface Offer {
  id: number;
  seller: Seller;
  basePrice: number; // 100..200
  discountPercent: number; // 3..20
  cashbackPercent: number; // 5..15
  priceAfterDiscount: number;
  cashbackAmount: number;
  effectivePrice: number; // priceAfterDiscount - cashbackAmount
}

const PRODUCT_IMAGE = "/assets/product-sample.png";
const TOTAL_OFFERS = 100;
const SELLERS: Seller[] = ["A", "B", "C", "D", "E"];

/**
 * Детеминированный "рандом", чтобы список не менялся при каждом рендере.
 */
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

function generateOffers(): Offer[] {
  const rand = createRandom(20261009);

  return Array.from({ length: TOTAL_OFFERS }, (_, i) => {
    const id = i + 1;
    const seller = SELLERS[intInRange(rand, 0, SELLERS.length - 1)];
    const basePrice = intInRange(rand, 100, 200);
    const discountPercent = intInRange(rand, 3, 20);
    const cashbackPercent = intInRange(rand, 5, 15);

    const priceAfterDiscount = round2(basePrice * (1 - discountPercent / 100));
    const cashbackAmount = round2(priceAfterDiscount * (cashbackPercent / 100));
    const effectivePrice = round2(priceAfterDiscount - cashbackAmount);

    return {
      id,
      seller,
      basePrice,
      discountPercent,
      cashbackPercent,
      priceAfterDiscount,
      cashbackAmount,
      effectivePrice,
    };
  });
}

export default function ProductOffers() {
  const offers = useMemo(() => generateOffers(), []);

  const sellerStats = useMemo(() => {
    return SELLERS.map((seller) => {
      const sellerOffers = offers.filter((o) => o.seller === seller);
      const avgEffective =
        sellerOffers.reduce((sum, o) => sum + o.effectivePrice, 0) /
        Math.max(1, sellerOffers.length);

      return {
        seller,
        count: sellerOffers.length,
        avgEffective: round2(avgEffective),
      };
    });
  }, [offers]);

  return (
    <main
      style={{
        minHeight: "calc(100vh - 72px)",
        padding: "24px 16px 32px",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
        color: "#173a33",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <section style={{ maxWidth: 1180, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 10px", fontSize: 34 }}>Образец продукта</h1>
        <p style={{ margin: "0 0 18px", lineHeight: 1.6 }}>
          Сгенерировано 100 предложений. Продавцы: A, B, C, D, E. Диапазоны:
          базовая цена 100–200, cashback 5–15%, скидка 3–20%.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "220px 1fr",
            gap: 18,
            alignItems: "start",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.88)",
              borderRadius: 14,
              padding: 12,
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            }}
          >
            <img
              src={PRODUCT_IMAGE}
              alt="Образец продукта"
              style={{
                width: "100%",
                maxHeight: 260,
                objectFit: "contain",
                display: "block",
                borderRadius: 10,
                background: "#fff",
              }}
            />
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.88)",
              borderRadius: 14,
              padding: 14,
              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 10, fontSize: 22 }}>
              Сводка по продавцам
            </h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {sellerStats.map((s) => (
                <div
                  key={s.seller}
                  style={{
                    minWidth: 150,
                    background: "#fff",
                    border: "1px solid rgba(0,0,0,0.08)",
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <strong>Продавец {s.seller}</strong>
                  <div>Предложений: {s.count}</div>
                  <div>Средняя итоговая: {s.avgEffective}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            overflowX: "auto",
            background: "rgba(255,255,255,0.92)",
            borderRadius: 14,
            boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 980,
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "#eef6ff" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Изображение</th>
                <th style={thStyle}>Товар</th>
                <th style={thStyle}>Продавец</th>
                <th style={thStyle}>Базовая цена</th>
                <th style={thStyle}>Скидка %</th>
                <th style={thStyle}>Cashback %</th>
                <th style={thStyle}>Цена после скидки</th>
                <th style={thStyle}>Сумма cashback</th>
                <th style={thStyle}>Итоговая цена</th>
              </tr>
            </thead>

            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td style={tdStyle}>{offer.id}</td>
                  <td style={tdStyle}>
                    <img
                      src={PRODUCT_IMAGE}
                      alt=""
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "contain",
                        display: "block",
                        margin: "0 auto",
                      }}
                    />
                  </td>
                  <td style={tdStyle}>Образец продукта #{offer.id}</td>
                  <td style={tdStyle}>Продавец {offer.seller}</td>
                  <td style={tdStyle}>{offer.basePrice}</td>
                  <td style={tdStyle}>{offer.discountPercent}%</td>
                  <td style={tdStyle}>{offer.cashbackPercent}%</td>
                  <td style={tdStyle}>{offer.priceAfterDiscount}</td>
                  <td style={tdStyle}>{offer.cashbackAmount}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#0f4f42" }}>
                    {offer.effectivePrice}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #d9e3f0",
  padding: "10px 8px",
  textAlign: "center",
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #eef1f4",
  padding: "9px 8px",
  textAlign: "center",
};