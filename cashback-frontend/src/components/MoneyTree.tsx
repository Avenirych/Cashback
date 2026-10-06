import React, { useState, useEffect } from "react";

interface MoneyTreeProps {
  coinCount?: number;
}

export default function MoneyTree({ coinCount = 15 }: MoneyTreeProps) {
  const [coins, setCoins] = useState<Array<{ id: number; x: number; y: number; falling?: boolean }>>([]);
  const [basketCoins, setBasketCoins] = useState(0);

  useEffect(() => {
    // Initialize coins on branches
    const initialCoins = Array.from({ length: coinCount }, (_, i) => ({
      id: i,
      x: Math.random() * 60 + 20,
      y: Math.random() * 50 + 15,
      falling: false,
    }));
    setCoins(initialCoins);
  }, [coinCount]);

  // Simulate coin falling every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (coins.length > basketCoins) {
        const randomCoin = coins[Math.floor(Math.random() * coins.length)];
        if (randomCoin && !randomCoin.falling) {
          setCoins((prev) =>
            prev.map((c) =>
              c.id === randomCoin.id ? { ...c, falling: true } : c
            )
          );

          setTimeout(() => {
            setCoins((prev) =>
              prev.filter((c) => c.id !== randomCoin.id)
            );
            setBasketCoins((prev) => prev + 1);
          }, 1500);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [coins, basketCoins]);

  const coinStyle: React.CSSProperties = {
    animation: "swing 3s ease-in-out infinite",
    transformOrigin: "top center",
    transformBox: "fill-box",
  };

  return (
    <div
      style={{
        maxWidth: "420px",
        position: "relative",
        margin: "0 auto",
      }}
    >
      <style>{`
        @keyframes swing {
          0%, 100% { transform: rotateZ(-2deg); }
          50% { transform: rotateZ(2deg); }
        }

        @keyframes fall {
          0% {
            opacity: 1;
            transform: translateY(0px);
          }
          100% {
            opacity: 0;
            transform: translateY(200px);
          }
        }

        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 0px #ffd700); }
          50% { filter: drop-shadow(0 0 8px #ffd700); }
        }

        .tree-coin {
          cursor: pointer;
          transition: filter 0.3s ease;
        }

        .tree-coin:hover {
          animation: glow 0.6s ease-in-out;
        }

        .falling-coin {
          animation: fall 1.5s ease-in forwards;
          position: absolute;
        }
      `}</style>

      <svg
        viewBox="0 0 500 450"
        style={{
          width: "100%",
          height: "auto",
          filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.1))",
        }}
      >
        {/* Sky background */}
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8f5e9" />
            <stop offset="100%" stopColor="#c8e6c9" />
          </linearGradient>
          <filter id="shadow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        <rect width="500" height="450" fill="url(#skyGradient)" />

        {/* Grass */}
        <ellipse cx="250" cy="420" rx="180" ry="30" fill="#7cb342" />

        {/* Tree trunk */}
        <rect x="210" y="280" width="80" height="140" rx="8" fill="#6d4c41" />

        {/* Tree branches and leaves */}
        <g id="tree">
          {/* Main crown */}
          <ellipse cx="250" cy="180" rx="140" ry="160" fill="#7cb342" />
          <ellipse cx="180" cy="120" rx="100" ry="120" fill="#8bc34a" />
          <ellipse cx="320" cy="120" rx="100" ry="120" fill="#8bc34a" />
          <ellipse cx="140" cy="200" rx="90" ry="100" fill="#9ccc65" />
          <ellipse cx="360" cy="200" rx="90" ry="100" fill="#9ccc65" />

          {/* Leaves details */}
          <circle cx="100" cy="280" r="40" fill="#7cb342" opacity="0.8" />
          <circle cx="400" cy="280" r="40" fill="#7cb342" opacity="0.8" />
        </g>

        {/* Ladder */}
        <line x1="220" y1="280" x2="220" y2="380" stroke="#8d6e63" strokeWidth="4" />
        <line x1="240" y1="280" x2="240" y2="380" stroke="#8d6e63" strokeWidth="4" />
        <line x1="220" y1="310" x2="240" y2="310" stroke="#8d6e63" strokeWidth="3" />
        <line x1="220" y1="340" x2="240" y2="340" stroke="#8d6e63" strokeWidth="3" />
        <line x1="220" y1="370" x2="240" y2="370" stroke="#8d6e63" strokeWidth="3" />

        {/* Coins on branches */}
        {coins.map((coin) => (
          <g key={coin.id} style={coinStyle}>
            <circle
              cx={`${coin.x}%`}
              cy={`${coin.y}%`}
              r="18"
              fill="#d4af37"
              stroke="#c9a227"
              strokeWidth="1.5"
              className="tree-coin"
              filter="url(#shadow)"
            />
            <text
              x={`${coin.x}%`}
              y={`${coin.y}%`}
              textAnchor="middle"
              dy="0.35em"
              fontSize="20"
              fontWeight="bold"
              fill="#6d4c41"
              pointerEvents="none"
            >
              ₹
            </text>
          </g>
        ))}

        {/* Basket */}
        <g id="basket">
          {/* Basket body */}
          <ellipse cx="380" cy="370" rx="60" ry="40" fill="#a1887f" />
          <path
            d="M 320 370 Q 320 350 380 340 Q 440 350 440 370"
            fill="#c4a57b"
            stroke="#8d6e63"
            strokeWidth="1.5"
          />

          {/* Basket weave pattern */}
          <line x1="340" y1="340" x2="340" y2="395" stroke="#8d6e63" strokeWidth="1" opacity="0.5" />
          <line x1="360" y1="340" x2="360" y2="395" stroke="#8d6e63" strokeWidth="1" opacity="0.5" />
          <line x1="380" y1="340" x2="380" y2="395" stroke="#8d6e63" strokeWidth="1" opacity="0.5" />
          <line x1="400" y1="340" x2="400" y2="395" stroke="#8d6e63" strokeWidth="1" opacity="0.5" />
          <line x1="420" y1="340" x2="420" y2="395" stroke="#8d6e63" strokeWidth="1" opacity="0.5" />

          {/* Handle */}
          <path
            d="M 340 340 Q 380 300 420 340"
            stroke="#8d6e63"
            strokeWidth="3"
            fill="none"
          />

          {/* Coins in basket */}
          {Array.from({ length: Math.min(basketCoins, 8) }).map((_, i) => (
            <circle
              key={`basket-coin-${i}`}
              cx={360 + (i % 3) * 15 - 15}
              cy={365 - Math.floor(i / 3) * 12}
              r="10"
              fill="#d4af37"
              stroke="#c9a227"
              strokeWidth="0.8"
              opacity="0.9"
            />
          ))}

          {/* Basket coin counter */}
          {basketCoins > 0 && (
            <text
              x="380"
              y="415"
              textAnchor="middle"
              fontSize="16"
              fontWeight="bold"
              fill="#6d4c41"
            >
              {basketCoins} coins
            </text>
          )}
        </g>
      </svg>

      {/* Falling coin animation */}
      {coins.map(
        (coin) =>
          coin.falling && (
            <div
              key={`falling-${coin.id}`}
              className="falling-coin"
              style={{
                left: `${coin.x}%`,
                top: `${coin.y}%`,
              }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="#d4af37" stroke="#c9a227" strokeWidth="1.5" />
                <text x="18" y="22" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#6d4c41">
                  ₹
                </text>
              </svg>
            </div>
          )
      )}
    </div>
  );
}
