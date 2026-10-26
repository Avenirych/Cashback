import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { useOnboarding } from "../onboarding";
import content from "../content/researchPrograms.json";
import rewardCopy from "../content/researchRewards.json";
import "./BonusResearch.css";

const directionPaths: Record<number, string> = {
  1: "surveys",
  2: "focus-groups",
  3: "ux",
  4: "mystery-shopping",
  5: "health",
  6: "b2b",
  7: "diaries",
  8: "communities",
  9: "academic",
  10: "experts",
};

export default function BonusResearch() {
  const navigate = useNavigate();
  const { user, token, loading } = useAuth();
  const { eligible } = useOnboarding();
  const { lang } = useLang();
  const t = content[lang.toUpperCase() as keyof typeof content] ?? content.EN;
  const rewards = rewardCopy[lang.toUpperCase() as keyof typeof rewardCopy] ?? rewardCopy.EN;

  const onParticipate = (cardId: number) => {
    if (loading) return;

    const direction = directionPaths[cardId];
    if (!direction) return;

    const next = `/bonuses/research/${direction}`;

    // Регистрация / подтверждение почты —
    // только после нажатия «Участвовать».
    if (!user || !token || !user.email_verified) {
      navigate(
        `/register?next=${encodeURIComponent(next)}`
      );
      return;
    }

    // Сохраняем обязательное подключение к программе.
    if (!eligible) {
      navigate("/profile", {
        state: {
          bonusOnboardingRequired: true,
          next,
        },
      });
      return;
    }

    navigate(next);
  };

  return (
    <main
      className="research-catalog"
      style={{
        minHeight: "calc(100vh - 72px)",
        padding: "28px 20px 36px",
        background:
          "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        color: "#173a33",
      }}
    >
      <section
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(26px, 4vw, 34px)",
            overflowWrap: "anywhere",
            lineHeight: 1.2,
          }}
        >
          {t.pageTitle}
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            fontSize: "17px",
            lineHeight: 1.55,
          }}
        >
          {t.pageSubtitle}
        </p>

        <section className="research-information" aria-labelledby="research-important-title">
          <h2 id="research-important-title">{t.importantTitle}</h2>
          {t.importantParagraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </section>

        <p className="research-range-disclaimer">{rewards.disclaimer}</p>
        <div
          className="research-catalog-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "16px",
          }}
        >
          {t.cards.map((card) => (
            <article
              key={card.id}
              style={{
                background: "rgba(255,255,255,0.88)",
                borderRadius: "14px",
                padding: "16px",
                boxShadow:
                  "0 6px 18px rgba(0,0,0,0.08)",
                border:
                  "1px solid rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "20px",
                  lineHeight: 1.3,
                }}
              >
                {card.title}
              </h2>

              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "15px",
                  lineHeight: 1.5,
                }}
              >
                {card.summary}
              </p>

              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "15px",
                  lineHeight: 1.5,
                }}
              >
                {card.goals}
              </p>

              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "15px",
                  lineHeight: 1.5,
                }}
              >
                {card.participants}
              </p>

              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: "15px",
                  lineHeight: 1.5,
                }}
              >
                {card.conditions}
              </p>

              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  lineHeight: 1.5,
                  fontWeight: 700,
                  color: "#0f4f42",
                }}
              >
                {rewards.cards[card.id - 1]}
              </p>

              <button
                type="button"
                onClick={() => onParticipate(card.id)}
                disabled={loading}
                aria-label={`${t.participate}: ${card.title}`}
                style={{
                  display: "inline-block",
                  marginTop: "18px",
                  padding: "12px 20px",
                  background: "#0078ff",
                  color: "#fff",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "16px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: loading
                    ? "not-allowed"
                    : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? t.waiting : t.participate}
              </button>
            </article>
          ))}
        </div>
        <section className="research-information research-rewards" aria-labelledby="research-rewards-title">
          <h2 id="research-rewards-title">{t.rewardsTitle}</h2>
          {t.rewardsParagraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <p>{t.rewardsBefore}<Link to="/activity-limits">{t.rulesLink}</Link>{t.rewardsAfter}</p>
          <p>{t.bonusNature}</p>
        </section>
      </section>
    </main>
  );
}
