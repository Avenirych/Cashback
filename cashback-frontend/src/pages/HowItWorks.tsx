import React from "react";

export default function HowItWorks() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
        padding: "60px 40px",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "48px", fontWeight: 700, marginBottom: "30px" }}>
          How It Works
        </h1>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "30px",
            marginBottom: "40px",
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              background: "rgba(255,255,255,0.8)",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#0078ff",
                marginBottom: "12px",
              }}
            >
              1
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>
              Sign Up
            </h3>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text)" }}>
              Create your Cashback+ account in seconds. It's free and easy!
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              background: "rgba(255,255,255,0.8)",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#0078ff",
                marginBottom: "12px",
              }}
            >
              2
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>
              Browse Partners
            </h3>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text)" }}>
              Explore hundreds of partner stores offering cashback rewards.
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              background: "rgba(255,255,255,0.8)",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#0078ff",
                marginBottom: "12px",
              }}
            >
              3
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>
              Shop & Earn
            </h3>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text)" }}>
              Click through to the store and shop normally. We track your purchase.
            </p>
          </div>

          {/* Step 4 */}
          <div
            style={{
              background: "rgba(255,255,255,0.8)",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#ff3b3b",
                marginBottom: "12px",
              }}
            >
              4
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>
              Earn Bonuses
            </h3>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text)" }}>
              Watch ads or participate in research to earn extra bonuses.
            </p>
          </div>

          {/* Step 5 */}
          <div
            style={{
              background: "rgba(255,255,255,0.8)",
              padding: "30px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                fontSize: "36px",
                fontWeight: 700,
                color: "#ff3b3b",
                marginBottom: "12px",
              }}
            >
              5
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "12px" }}>
              Get Rewards
            </h3>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--text)" }}>
              Redeem your cashback and bonuses. It's that simple!
            </p>
          </div>
        </div>

        <section style={{ background: "rgba(255,255,255,0.8)", padding: "30px", borderRadius: "12px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "16px" }}>
            Maximize Your Earnings
          </h2>
          <ul style={{ fontSize: "15px", lineHeight: 1.8, paddingLeft: "20px" }}>
            <li style={{ marginBottom: "12px" }}>
              Use our browser extension to get notifications about cashback opportunities
            </li>
            <li style={{ marginBottom: "12px" }}>
              Combine cashback with special promotions for even bigger rewards
            </li>
            <li style={{ marginBottom: "12px" }}>
              Invite friends and earn referral bonuses
            </li>
            <li>
              Check our community forum for tips and best deals
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
