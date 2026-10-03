import React from "react";
import "./Forum.css";
import { useAuth } from "../context/AuthContext";

interface ForumProps {
  lang: string;
}

export default function Forum({ lang }: ForumProps) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="forum-container">
        <h1>Forum</h1>
        <p>You must log in to access the forum.</p>
      </div>
    );
  }

  if (!user.agreedRules || !user.forumUsername) {
    return (
      <div className="forum-container">
        <h1>Forum</h1>
        <p>You must complete forum registration.</p>
        <a href="/forum-register" className="forum-register-link">
          Go to Forum Registration
        </a>
      </div>
    );
  }

  // 🔥 ТВОЙ ПОЛНЫЙ БЛОК ПЕРЕВОДОВ — вставлен полностью и корректно
  const t = {
    en: {
      title: "Community Forum",
      intro:
        "Welcome to the Cashback+ Community Forum — a safe and moderated space for discussions, questions, ideas, and user-to-user support.",
      categories: "Forum Categories",
      search: "Search topics...",
      newTopic: "Create New Topic",
      rulesTitle: "Forum Rules (UK Legal Requirements)",
      rules: [
        "No insults, harassment, hate speech or threats.",
        "No defamatory content (UK Defamation Law).",
        "No copyrighted content without permission.",
        "No spam or fraudulent activity.",
        "Respect GDPR: do not publish personal data of others.",
      ],
      gdprTitle: "GDPR & Privacy",
      gdprText:
        "Cashback+ collects minimal technical data (IP address, browser type) for security and moderation purposes, in accordance with UK GDPR.",
      cookiesTitle: "Cookie Notice",
      cookiesText:
        "This forum uses cookies required for authentication and session stability.",
      report: "Report",
      topicsTitle: "Latest Topics",
      noTopics: "No topics yet. Be the first to create one!",
    },

    ru: {
      title: "Форум сообщества",
      intro:
        "Добро пожаловать на форум Cashback+ — безопасное и модерируемое пространство для обсуждений, вопросов, идей и поддержки между пользователями.",
      categories: "Категории форума",
      search: "Поиск тем...",
      newTopic: "Создать новую тему",
      rulesTitle: "Правила форума (требования Великобритании)",
      rules: [
        "Запрещены оскорбления, преследование, разжигание ненависти и угрозы.",
        "Запрещена клевета (UK Defamation Law).",
        "Запрещено размещать контент, защищённый авторским правом.",
        "Запрещён спам и мошенничество.",
        "Соблюдайте GDPR: не публикуйте личные данные других людей.",
      ],
      gdprTitle: "GDPR и конфиденциальность",
      gdprText:
        "Cashback+ собирает минимальные технические данные (IP‑адрес, тип браузера) для безопасности и модерации, в соответствии с UK GDPR.",
      cookiesTitle: "Уведомление о cookie",
      cookiesText:
        "Форум использует cookie, необходимые для авторизации и стабильности сессии.",
      report: "Пожаловаться",
      topicsTitle: "Последние темы",
      noTopics: "Тем пока нет. Создайте первую!",
    },

    fr: {
      title: "Forum Communautaire",
      intro:
        "Bienvenue sur le forum Cashback+ — un espace sûr et modéré pour les discussions, questions et idées.",
      categories: "Catégories du forum",
      search: "Rechercher...",
      newTopic: "Créer un nouveau sujet",
      rulesTitle: "Règles du forum (Exigences légales UK)",
      rules: [
        "Pas d'insultes, harcèlement, discours haineux ou menaces.",
        "Pas de contenu diffamatoire (UK Defamation Law).",
        "Pas de contenu protégé par copyright sans autorisation.",
        "Pas de spam ou fraude.",
        "Respect du GDPR : ne publiez pas les données personnelles d’autrui.",
      ],
      gdprTitle: "GDPR & Confidentialité",
      gdprText:
        "Cashback+ collecte des données techniques minimales pour la sécurité et la modération, conformément au GDPR britannique.",
      cookiesTitle: "Avis de cookies",
      cookiesText:
        "Ce forum utilise des cookies nécessaires à l’authentification.",
      report: "Signaler",
      topicsTitle: "Sujets récents",
      noTopics: "Aucun sujet pour le moment.",
    },

    de: {
      title: "Community Forum",
      intro:
        "Willkommen im Cashback+ Forum — ein sicherer, moderierter Raum für Diskussionen, Fragen und Ideen.",
      categories: "Forumkategorien",
      search: "Themen suchen...",
      newTopic: "Neues Thema erstellen",
      rulesTitle: "Forenregeln (UK Gesetzgebung)",
      rules: [
        "Keine Beleidigungen, Belästigung, Hassrede oder Drohungen.",
        "Keine Verleumdung (UK Defamation Law).",
        "Keine urheberrechtlich geschützten Inhalte ohne Erlaubnis.",
        "Kein Spam oder Betrug.",
        "GDPR beachten: keine persönlichen Daten anderer veröffentlichen.",
      ],
      gdprTitle: "GDPR & Datenschutz",
      gdprText:
        "Cashback+ sammelt minimale technische Daten für Sicherheit und Moderation gemäß UK GDPR.",
      cookiesTitle: "Cookie-Hinweis",
      cookiesText:
        "Dieses Forum verwendet Cookies für Authentifizierung und Sitzungsstabilität.",
      report: "Melden",
      topicsTitle: "Neueste Themen",
      noTopics: "Noch keine Themen.",
    },
  };

  const L = t[lang] || t.en;

  return (
    <div className="forum-container">
      <h1>{L.title}</h1>

      <p>{L.intro}</p>

      {/* Search */}
      <input
        type="text"
        placeholder={L.search}
        className="forum-search"
      />

      {/* Categories */}
      <section>
        <h2>{L.categories}</h2>
        <ul className="forum-categories">
          <li>General Discussion</li>
          <li>Cashback Questions</li>
          <li>Research Participation</li>
          <li>Video Bonuses</li>
          <li>Technical Support</li>
          <li>Off-topic</li>
        </ul>
      </section>

      {/* New Topic Button */}
      <button className="forum-new-topic">{L.newTopic}</button>

      {/* Latest Topics */}
      <section>
        <h2>{L.topicsTitle}</h2>
        <p>{L.noTopics}</p>
      </section>

      {/* Rules */}
      <section>
        <h2>{L.rulesTitle}</h2>
        <ul className="forum-rules">
          {L.rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      {/* GDPR */}
      <section>
        <h2>{L.gdprTitle}</h2>
        <p>{L.gdprText}</p>
      </section>

      {/* Cookies */}
      <section>
        <h2>{L.cookiesTitle}</h2>
        <p>{L.cookiesText}</p>
      </section>
    </div>
  );
}
