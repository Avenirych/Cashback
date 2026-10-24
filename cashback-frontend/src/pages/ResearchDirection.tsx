import React from "react";
import { Link, useParams } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import {
  directions,
  studies,
  getDirectionText,
  getResearchMessages,
} from "../researchData";
import "./BonusResearch.css";

const STUDY_IMAGE_URL = "/assets/background2.png";

export default function ResearchDirection() {
  const { directionId } = useParams<{ directionId: string }>();
  const { lang } = useLang();
  const t = getResearchMessages(lang);

  const direction = directions.find(
    (item) => item.id === directionId
  );

  if (!direction) {
    return (
      <main className="research-page">
        <div className="research-container">
          <h1>{t.notFound}</h1>
          <Link className="research-back" to="/bonuses/research">
            ← {t.back}
          </Link>
        </div>
      </main>
    );
  }

  const text = getDirectionText(direction, lang);
  const directionStudies = studies
    .filter((study) => study.directionId === direction.id)
    .sort((a, b) => a.id - b.id);

  return (
    <main className="research-page">
      <div className="research-container">
        <Link className="research-back" to="/bonuses/research">
          ← {t.back}
        </Link>

        <h1>{text.title}</h1>
        <p className="research-subtitle">{text.summary}</p>

        <section className="research-details">
          <dl className="research-description">
            <dt>{t.goals}</dt>
            <dd>{text.goals}</dd>

            <dt>{t.participants}</dt>
            <dd>{text.participants}</dd>

            <dt>{t.conditions}</dt>
            <dd>{text.conditions}</dd>

            <dt>{t.expected}</dt>
            <dd>{t.bonusRange}</dd>
          </dl>
        </section>

        <p className="research-demo">{t.demo}</p>

        <h2 className="research-list-title">
          {t.studyCount}: {directionStudies.length}
        </h2>

        <div className="research-study-list">
          {directionStudies.map((study) => (
            <article className="research-study" key={study.id}>
              <img
                className="research-study-image"
                src={STUDY_IMAGE_URL}
                alt=""
                loading="lazy"
              />

              <div className="research-study-info">
                <h3>{t.studyName(study.id)}</h3>
                <p>{text.title}</p>
              </div>

              <div className="research-study-bonuses">
                <span>{t.expected}</span>
                <strong>{study.expectedBonuses}</strong>
              </div>

              <Link
                className="research-button research-participate"
                to="/partner-not-connected"
                aria-label={`${t.participate}: ${t.studyName(study.id)}`}
              >
                {t.participate}
              </Link>
            </article>
          ))}

          {directionStudies.length === 0 && <p>{t.empty}</p>}
        </div>
      </div>
    </main>
  );
}