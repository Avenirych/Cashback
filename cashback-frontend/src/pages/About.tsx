import React from "react";

export default function About() {
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
          About Us
        </h1>

        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "16px" }}>
            Our Mission
          </h2>
          <p style={{ fontSize: "16px", lineHeight: 1.8, color: "var(--text)" }}>
            At Cashback+, we believe shopping should reward you. Our mission is to make
            every purchase more valuable by combining cashback, bonuses, and rewards in
            one seamless platform.
          </p>
        </section>

        <section style={{ marginBottom: "40px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "16px" }}>
            Why Choose Us?
          </h2>
          <ul style={{ fontSize: "16px", lineHeight: 1.8, paddingLeft: "20px" }}>
            <li style={{ marginBottom: "12px" }}>
              <strong>Earn Cashback</strong> - Get money back on every purchase from our
              partner stores
            </li>
            <li style={{ marginBottom: "12px" }}>
              <strong>Bonus Rewards</strong> - Watch ads and participate in research to
              earn extra bonuses
            </li>
            <li style={{ marginBottom: "12px" }}>
              <strong>Transparent & Fair</strong> - No hidden fees, just pure rewards
            </li>
            <li style={{ marginBottom: "12px" }}>
              <strong>Community</strong> - Join our forum and connect with other users
            </li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: "28px", fontWeight: 600, marginBottom: "16px" }}>
            Our Team
          </h2>
          <p style={{ fontSize: "16px", lineHeight: 1.8, color: "var(--text)" }}>
            Founded in 2024, Cashback+ is dedicated to giving power back to consumers.
            We're constantly innovating to bring you the best shopping rewards experience.
          </p>
        </section>
      </div>
    </div>
  );
}
