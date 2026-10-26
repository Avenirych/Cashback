import React from "react";
import content from "../content/bonusPrograms.json";
import "./Bonuses.css";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";

export default function Bonuses() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const language = lang.toLowerCase() as keyof typeof content;
  const copy = content[language] || content.en;

  const buttonStyle: React.CSSProperties = {
    padding: "16px 24px",
    color: "white",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: 600,
  };

  return (
    <main className="bonuses-page" lang={language}>
      <section className="bonuses-container">
        <h1>{copy.title}</h1>
        <p className="bonuses-introduction">{copy.description}</p>
        <div className="bonuses-programs">
          <article className="bonus-program-card">
            <button type="button" onClick={() => navigate("/bonuses/ads")}
              style={{ ...buttonStyle, background: "#0078ff" }}>{copy.adsTitle}</button>
            <p>{copy.adsDescription}</p>
          </article>
          <article className="bonus-program-card">
            <button type="button" onClick={() => navigate("/bonuses/research")}
              style={{ ...buttonStyle, background: "#ff3b3b" }}>{copy.researchTitle}</button>
            <p>{copy.researchDescription}</p>
          </article>
        </div>
        <section className="bonuses-information" aria-labelledby="bonuses-information-title">
          <h2 id="bonuses-information-title">{copy.importantTitle}</h2>
          {copy.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <p>{copy.termsBefore}<Link to="/activity-limits">{copy.activityLink}</Link>{copy.termsBetween}<Link to="/terms">{copy.termsLink}</Link>{copy.termsAfter}</p>
        </section>
      </section>
    </main>
  );
}
