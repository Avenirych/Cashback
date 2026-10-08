import React from "react";

export default function PartnerNotConnected() {
  return (
    <main
      style={{
        minHeight: "calc(100vh - 72px)",
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
      }}
    >
      <section
        style={{
          width: "min(980px, 100%)",
          background: "rgba(255,255,255,0.78)",
          borderRadius: "18px",
          padding: "20px 16px 26px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "min(64vw, 620px)",
            margin: "0 auto",
            lineHeight: 0,
          }}
        >
          {/* Cat image */}
          <img
            src="/assets/cat.png"
            alt="Partner is not connected yet"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: "12px",
            }}
          />

          {/* Coin medallion moved right above "O" in "connected" */}
          <img
            src="/assets/coin.png"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "54%",
              top: "81%",
              transform: "translate(-50%, -50%)",
              width: "12%",
              maxWidth: "86px",
              minWidth: "42px",
              height: "auto",
              filter: "drop-shadow(0 4px 6px rgba(0,0,0,.35))",
              zIndex: 6,
            }}
          />
        </div>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: "clamp(20px, 2.8vw, 34px)",
            fontWeight: 700,
            color: "#2a2928",
          }}
        >
          Partner is not connected yet
        </p>
      </section>
    </main>
  );
}