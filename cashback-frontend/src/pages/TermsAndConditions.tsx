import React from "react";

export default function TermsAndConditions() {
  return (
    <div
      style={{
        padding: "32px 40px",
        maxWidth: "960px",
        margin: "0 auto",
        color: "var(--text)",
        background: "var(--bg)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
      }}
    >
      <h1
        style={{
          fontSize: "32px",
          marginBottom: "8px",
          fontWeight: 700,
        }}
      >
        Cashback+ Terms and Conditions
      </h1>

      <p
        style={{
          marginBottom: "4px",
          fontSize: "14px",
          color: "var(--text-secondary)",
        }}
      >
        Effective date: 30 September 2026
      </p>
      <p
        style={{
          marginBottom: "24px",
          fontSize: "14px",
          color: "var(--text-secondary)",
        }}
      >
        Jurisdiction: United Kingdom
      </p>

      <Section title="1. Who We Are">
        <p>
          Cashback+ is a UK-based rewards platform operated by Cashback Plus Ltd.
          We provide users with cashback from retailers, bonuses for viewing
          advertising videos, and bonuses for participation in research
          programmes. Our service allows users to reduce the cost of purchases
          made through Cashback+ by combining cashback and bonuses, including
          compensation up to 100% of the purchase value.
        </p>
      </Section>

      <Section title="2. How Cashback+ Works">
        <p>
          Cashback+ provides three types of rewards: cashback from retailers,
          video bonuses, and research bonuses. Each reward type has its own
          rules and is credited differently.
        </p>
      </Section>

      {/* ===========================
          INTEGRATED LEGAL BLOCK
      =========================== */}

      <Section title="3. Source of Cashback and Bonuses">
        <h3 style={{ fontSize: "17px", marginBottom: "10px" }}>
          3.1. Retailer Commission and Cashback
        </h3>
        <p>
          When a user makes a purchase through Cashback+, the retailer pays
          Cashback+ a commission for referring the customer. Cashback+ transfers
          a defined percentage of this commission to the user as cashback. The
          cashback percentage varies depending on the retailer and is displayed
          to the user before the purchase is made.
        </p>

        <h3 style={{ fontSize: "17px", marginTop: "20px", marginBottom: "10px" }}>
          3.2. Bonuses for Viewing Advertising Videos
        </h3>
        <p>
          Users may voluntarily view advertising video materials. Cashback+
          credits bonuses as a share of the advertising commission received.
          These bonuses:
        </p>
        <ul>
          <li>are a share of commission that Cashback+ distributes to the user;</li>
          <li>are credited to the user’s bonus balance;</li>
          <li>are not electronic money or a financial instrument;</li>
          <li>cannot be withdrawn directly;</li>
          <li>may only be used to compensate the cost of purchases on Cashback+;</li>
          <li>have a fixed value: <strong>1 bonus = £1</strong> when compensating a purchase.</li>
        </ul>
        <p>
          Before viewing a video, the user sees the exact number of bonuses that
          will be credited.
        </p>

        <h3 style={{ fontSize: "17px", marginTop: "20px", marginBottom: "10px" }}>
          3.3. Bonuses for Participation in Research Programmes
        </h3>
        <p>
          Research companies may pay Cashback+ a commission for attracting users
          to participate in surveys, interviews, or product testing. Cashback+
          transfers a percentage of this commission to the user in the form of
          bonuses. These bonuses:
        </p>
        <ul>
          <li>are a share of the commission distributed by Cashback+;</li>
          <li>are credited to the user’s bonus balance;</li>
          <li>cannot be withdrawn directly;</li>
          <li>may only be used to compensate purchases;</li>
          <li>are shown to the user before participation.</li>
        </ul>

        <h3 style={{ fontSize: "17px", marginTop: "20px", marginBottom: "10px" }}>
          3.3.1. Direct Payments from Research Companies
        </h3>
        <p>
          Some research companies may pay users directly for participation (e.g.
          £20 for an interview). These payments:
        </p>
        <ul>
          <li>are made directly to the user;</li>
          <li>do not pass through Cashback+;</li>
          <li>are not reflected in the Cashback+ balance;</li>
          <li>do not participate in any calculations between Cashback+ and the user.</li>
        </ul>

        <h3 style={{ fontSize: "17px", marginTop: "20px", marginBottom: "10px" }}>
          3.4. Transfer of Bonuses Between Users
        </h3>
        <p>
          Users may transfer bonuses to other registered Cashback+ users,
          including forum participants. Transferred bonuses retain their purpose
          and may only be used by the recipient to compensate purchases.
        </p>
      </Section>

      <Section title="4. Monetisation of Bonuses and Payouts">
        <h3 style={{ fontSize: "17px", marginBottom: "10px" }}>
          4.1. Bonus Monetisation
        </h3>
        <p>
          Bonuses may only be monetised when making a purchase through Cashback+.
          Monetisation automatically reduces the cost of the product by the
          bonus amount. If the combined value of cashback and bonuses equals the
          product price, the user receives up to 100% compensation.
        </p>

        <h3 style={{ fontSize: "17px", marginTop: "20px", marginBottom: "10px" }}>
          4.2. Payout of Cashback and Monetised Bonuses
        </h3>
        <p>
          Confirmed cashback and monetised bonuses may be paid out to the user
          immediately after automatic confirmation. Payouts are made as a single
          combined payment without partial withdrawal options.
        </p>

        <h3 style={{ fontSize: "17px", marginTop: "20px", marginBottom: "10px" }}>
          4.3. No Storage of Funds
        </h3>
        <p>
          Cashback+ does not store user funds. We do not accumulate balances,
          hold money, or allow funds to be used for future purchases. All
          payments are processed automatically and immediately after
          confirmation.
        </p>
      </Section>

      <Section title="5. Legal Restrictions and Clarifications">
        <ul>
          <li>Bonuses are not electronic money or a financial instrument.</li>
          <li>Bonuses cannot be exchanged for cash or used outside Cashback+.</li>
          <li>Cashback is credited only when purchases are tracked correctly.</li>
          <li>Bonuses are credited only when confirmed by advertisers or research companies.</li>
          <li>Direct payments from research companies do not pass through Cashback+.</li>
          <li>Cashback+ may adjust balances in case of errors, returns, or misuse.</li>
        </ul>
      </Section>

      <Section title="6. Behaviour and Account Rules">
        <p>
          Users must act honestly, provide accurate information, and refrain from
          creating duplicate accounts. Abusive behaviour, fraud, or attempts to
          manipulate the system may result in account suspension or closure.
        </p>
      </Section>

      <Section title="7. Legal Jurisdiction">
        <p>
          These Terms are governed by the laws of England and Wales. Any disputes
          shall be resolved by the courts of England and Wales.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section
      style={{
        marginBottom: "28px",
        paddingBottom: "18px",
        borderBottom: "1px solid var(--sidebar-border)",
      }}
    >
      <h2
        style={{
          fontSize: "20px",
          marginBottom: "10px",
          fontWeight: 600,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: "15px",
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </section>
  );
}
