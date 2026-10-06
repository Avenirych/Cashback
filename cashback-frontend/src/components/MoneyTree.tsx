import React, { useEffect, useRef, useState } from "react";
import logoCoin from "../assets/Coint1.png";
import treeImage from "../assets/Tree.jpg";

/**
 * MoneyTree компонент:
 * - Оригинальное изображение дерева с монетами и корзинкой
 * - Логотип сайта (Coint1.png) на ветках — покачивание и свечение при наведении
 * - Монеты падают в корзинку с вращением
 * - Накопленные монеты растут в корзинке
 * - Размер, форма, положение как у "Одуванчики" на Welcome (maxWidth 420px, borderRadius 20px)
 */

// Центры и размеры монет на изображении (в % от размеров картинки)
const COINS = [
  { id: 0, x: 48.1, y: 13.0, w: 6.8 },
  { id: 1, x: 39.3, y: 19.9, w: 8.6 },
  { id: 2, x: 71.4, y: 19.3, w: 8.8 },
  { id: 3, x: 16.2, y: 29.6, w: 10.2 },
  { id: 4, x: 27.2, y: 33.6, w: 6.3 },
  { id: 5, x: 42.5, y: 32.9, w: 9.0 },
  { id: 6, x: 71.3, y: 35.5, w: 6.4 },
  { id: 7, x: 83.6, y: 34.6, w: 8.4 },
  { id: 8, x: 87.9, y: 40.3, w: 8.2 },
  { id: 9, x: 11.1, y: 45.2, w: 9.4 },
  { id: 10, x: 70.5, y: 45.8, w: 9.4 },
  { id: 11, x: 27.9, y: 50.0, w: 6.1 },
  { id: 12, x: 19.8, y: 53.4, w: 9.6 },
  { id: 13, x: 59.9, y: 54.9, w: 9.0 },
];

// Уровень корзинки (где лежат монеты)
const BASKET = { x: 72.8, y: 74.0 };
const FALL_MS = 1400;

interface MoneyTreeProps {
  collected?: number;
}

export default function MoneyTree({ collected = 0 }: MoneyTreeProps) {
  const [falling, setFalling] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [regrown, setRegrown] = useState<number | null>(null);
  const [basket, setBasket] = useState(collected);
  const fallingRef = useRef<number | null>(null);

  useEffect(() => {
    setBasket(collected);
  }, [collected]);

  // Каждые ~3.5 c одна монета отрывается от ветки и падает в корзинку
  useEffect(() => {
    const timer = setInterval(() => {
      if (fallingRef.current !== null) return;
      const candidates = COINS.filter((c) => !hidden.includes(c.id));
      if (!candidates.length) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      fallingRef.current = pick.id;
      setFalling(pick.id);
      setHidden((h) => [...h, pick.id]);
    }, 3500);
    return () => clearInterval(timer);
  }, [hidden]);

  const onFallEnd = (id: number) => {
    fallingRef.current = null;
    setFalling(null);
    setBasket((b) => b + 1);
    // Через паузу на ветке "вырастает" новая монета
    setTimeout(() => {
      setHidden((h) => h.filter((x) => x !== id));
      setRegrown(id);
      setTimeout(() => setRegrown(null), 900);
    }, 1200);
  };

  const fallingCoin = COINS.find((c) => c.id === falling);
  const stack = Math.min(basket, 6);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        position: "relative",
        alignSelf: "flex-start",
        aspectRatio: "2 / 3",
        borderRadius: "20px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <style>{`
        @keyframes mt-sway {
          0%, 100% { transform: translate(-50%, -50%) rotate(-4deg); }
          50%      { transform: translate(-50%, -50%) rotate(4deg); }
        }
        @keyframes mt-grow {
          from { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          to   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes mt-fall {
          0%   { left: var(--x0); top: var(--y0); opacity: 1; }
          85%  { opacity: 1; }
          100% { left: var(--x1); top: var(--y1); opacity: 0; }
        }
        @keyframes mt-spin {
          from { transform: rotateY(0deg); }
          to   { transform: rotateY(720deg); }
        }
        .mt-coin {
          position: absolute;
          aspect-ratio: 1 / 1;
          cursor: pointer;
          animation: mt-sway 3s ease-in-out infinite;
          transition: filter 0.3s ease;
        }
        .mt-coin img { width: 100%; height: 100%; display: block; object-fit: contain; }
        .mt-coin:hover {
          filter: drop-shadow(0 0 6px #ffd54a) drop-shadow(0 0 14px #ffc400);
        }
        .mt-coin.mt-regrown { animation: mt-grow 0.9s ease-out; }
        .mt-falling {
          position: absolute;
          aspect-ratio: 1 / 1;
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: mt-fall ${FALL_MS}ms cubic-bezier(0.55, 0, 1, 0.9) forwards;
        }
        .mt-falling img {
          width: 100%; height: 100%; display: block; object-fit: contain;
          animation: mt-spin ${FALL_MS}ms linear;
        }
      `}</style>

      {/* Оригинальная картинка дерева */}
      <img
        src={treeImage}
        alt="Cashback tree"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {/* Покачивающиеся монеты на ветках (логотип сайта) */}
      {COINS.map((c) =>
        hidden.includes(c.id) ? null : (
          <div
            key={c.id}
            className={`mt-coin${regrown === c.id ? " mt-regrown" : ""}`}
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${c.w * 1.04}%`,
              animationDelay: `${(c.id % 5) * -0.6}s`,
            }}
          >
            <img src={logoCoin} alt="coin" />
          </div>
        )
      )}

      {/* Падающая монета — летит до уровня корзинки */}
      {fallingCoin && (
        <div
          key={`fall-${fallingCoin.id}-${basket}`}
          className="mt-falling"
          onAnimationEnd={(e) => {
            if (e.animationName === "mt-fall") onFallEnd(fallingCoin.id);
          }}
          style={
            {
              width: `${fallingCoin.w}%`,
              "--x0": `${fallingCoin.x}%`,
              "--y0": `${fallingCoin.y}%`,
              "--x1": `${BASKET.x + (Math.random() * 6 - 3)}%`,
              "--y1": `${BASKET.y}%`,
            } as React.CSSProperties
          }
        >
          <img src={logoCoin} alt="" />
        </div>
      )}

      {/* Накопленные монеты в корзинке */}
      {Array.from({ length: stack }).map((_, i) => (
        <div
          key={`b-${i}`}
          style={{
            position: "absolute",
            left: `${BASKET.x - 7 + (i % 3) * 6.5}%`,
            top: `${BASKET.y + 1 - Math.floor(i / 3) * 2.2}%`,
            width: "6.4%",
            aspectRatio: "1 / 1",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <img src={logoCoin} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      ))}

      {/* Счётчик */}
      {basket > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${BASKET.x}%`,
            top: "88%",
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.9)",
            color: "#6d4c41",
            fontWeight: 700,
            fontSize: "14px",
            padding: "2px 10px",
            borderRadius: "10px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          }}
        >
          {basket}
        </div>
      )}
    </div>
  );
}
