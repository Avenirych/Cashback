import React from "react";
import Footer from "../components/Footer";
import { translations } from "../i18n";

interface PrivacyPolicyProps {
  lang: string;
}

export default function PrivacyPolicy({
  lang,
}: PrivacyPolicyProps) {
  const normalizedLang = (lang || "EN").toUpperCase();
  const languageKey = normalizedLang as keyof typeof translations;
  const t = translations[languageKey] ?? translations.EN;

  const sections = [
    { key: "privacySection1", titleKey: "privacySection1", textKey: "privacyIntroText" },
    { key: "privacySection2", titleKey: "privacySection2", textKey: "privacyWhoWeAre" },
    { key: "privacySection3", titleKey: "privacySection3", hasSubsections: true },
    { key: "privacySection4", titleKey: "privacySection4", textKey: "privacyUsesList" },
    { key: "privacySection5", titleKey: "privacySection5", hasBases: true },
    { key: "privacySection6", titleKey: "privacySection6", textKey: "privacyTrackingText" },
    { key: "privacySection7", titleKey: "privacySection7", hasSharings: true },
    { key: "privacySection8", titleKey: "privacySection8", textKey: "privacyTransfersText" },
    { key: "privacySection9", titleKey: "privacySection9", hasRetentions: true },
    { key: "privacySection10", titleKey: "privacySection10", textKey: "privacySecurityText" },
    { key: "privacySection11", titleKey: "privacySection11", textKey: "privacyRights" },
    { key: "privacySection12", titleKey: "privacySection12", textKey: "privacyMarketingText" },
    { key: "privacySection13", titleKey: "privacySection13", textKey: "privacyCookiesText" },
    { key: "privacySection14", titleKey: "privacySection14", textKey: "privacyChildrenText" },
    { key: "privacySection15", titleKey: "privacySection15", textKey: "privacyComplaintsText" },
    { key: "privacySection16", titleKey: "privacySection16", textKey: "privacyChangesText" },
    { key: "privacySection17", titleKey: "privacySection17", textKey: "privacyEligibilityText" },
    { key: "privacySection18", titleKey: "privacySection18", textKey: "privacyPriceText" },
    { key: "privacySection19", titleKey: "privacySection19", textKey: "privacyContactText" },
  ];

  const formatText = (text: string) => {
    return text.split("\n").map((line, idx) => (
      <React.Fragment key={idx}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 72px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "900px",
          boxSizing: "border-box",
          margin: "0 auto",
          padding: "40px 20px 30px",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            marginBottom: "12px",
          }}
        >
          {t.privacyTitle}
        </h1>

        <p
          style={{
            color: "#666",
            fontSize: "14px",
            marginBottom: "32px",
          }}
        >
          {t.privacyLastUpdated}: January 2025
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}
        >
          {sections.map((section) => {
            const titleKey = section.titleKey as keyof typeof t;
            const textKey = section.textKey as keyof typeof t;
            const title = t[titleKey] as string;
            const text = textKey ? (t[textKey] as string) : undefined;

            return (
              <section key={section.key}>
                <h2
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    marginBottom: "12px",
                  }}
                >
                  {title}
                </h2>

                {section.hasSubsections && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacySubsection3a}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {formatText(t.privacyInfo3a as string)}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacySubsection3b}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {formatText(t.privacyInfo3b as string)}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacySubsection3c}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {formatText(t.privacyInfo3c as string)}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "12px",
                        background: "#fff3cd",
                        borderLeft: "4px solid #ffc107",
                        borderRadius: "4px",
                      }}
                    >
                      <p style={{ margin: 0, color: "#856404", fontSize: "14px" }}>
                        {t.privacyNotBankData}
                      </p>
                    </div>
                  </div>
                )}

                {section.hasBases && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyBasis1}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyBasisText1}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyBasis2}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyBasisText2}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyBasis3}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyBasisText3}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyBasis4}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyBasisText4}
                      </p>
                    </div>
                  </div>
                )}

                {section.hasSharings && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacySharing1}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacySharingText1}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacySharing2}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacySharingText2}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacySharing3}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacySharingText3}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacySharing4}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacySharingText4}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "12px",
                        background: "#e7f3ff",
                        borderLeft: "4px solid #2196F3",
                        borderRadius: "4px",
                      }}
                    >
                      <p style={{ margin: 0, color: "#0c5aa0", fontSize: "14px" }}>
                        {t.privacyNotSellData}
                      </p>
                    </div>
                  </div>
                )}

                {section.hasRetentions && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyRetention1}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyRetentionText1}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyRetention2}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyRetentionText2}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyRetention3}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyRetentionText3}
                      </p>
                    </div>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                        {t.privacyRetention4}
                      </h3>
                      <p style={{ color: "#555", lineHeight: 1.6 }}>
                        {t.privacyRetentionText4}
                      </p>
                    </div>
                  </div>
                )}

                {text && !section.hasSubsections && !section.hasBases && !section.hasSharings && !section.hasRetentions && (
                  <p
                    style={{
                      color: "#555",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      fontSize: "15px",
                    }}
                  >
                    {formatText(text)}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </main>

      <Footer lang={normalizedLang} />
    </div>
  );
}