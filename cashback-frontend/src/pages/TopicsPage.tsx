import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ForumHeader from "../components/ForumHeader";
import ForumAuthor from "../components/ForumAuthor";
import { FORUM_API_URL } from "../forum";
import type { ForumAuthor as Author } from "../forum";
import { translations } from "../i18n";
import "./Forum.css";
import ForumBonusExchangePanel from "./ForumBonusExchangePanel";

interface ForumTopic {
  id: number;
  title: string;
  created_at: string;
  author: Author;
}

interface TopicsPageProps {
  lang: string;
  onLangChange?: (lang: string) => void;
}

export default function TopicsPage({ lang }: TopicsPageProps) {
  const {
    user,
    token,
    forumUser,
    forumSessionActive,
    forumBanned,
  } = useAuth();

  const canWrite =
    !!user?.email_verified &&
    !!token &&
    forumSessionActive &&
    !!forumUser &&
    !forumUser.banned &&
    !forumBanned;

  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isRu = lang.toUpperCase() === "RU";

  const t =
    translations[lang.toUpperCase() as keyof typeof translations] ??
    translations.EN;

  useEffect(() => {
    const controller = new AbortController();

    setTopics([]);
    setLoading(true);
    setError("");

    fetch(`${FORUM_API_URL}/forum/topics`, {
      headers: {
        Authorization: "Bearer " + token,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load topics");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setTopics(Array.isArray(data) ? data : []);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error ? err.message : "Could not load topics"
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [token]);

  const createTopic = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!canWrite || creating) return;

    if (!title.trim()) {
      setError(t.enterTopicName);
      return;
    }

    setError("");
    setCreating(true);

    try {
      const response = await fetch(`${FORUM_API_URL}/forum/topic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          title: title.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) || "Failed to create topic"
        );
      }

      const topic: ForumTopic = await response.json();

      setTopics((previous) => [topic, ...previous]);
      setTitle("");
      setShowCreateForm(false);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create topic"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="forum-page">
      <main
        style={{
          maxWidth: 900,
          margin: "auto",
          padding: 24,
        }}
      >
        <Link to="/">{t.backToHome}</Link>

        <ForumHeader lang={lang} />

        {/* Существующая форма создания темы */}
        {canWrite &&
          (showCreateForm ? (
            <form className="forum-card" onSubmit={createTopic}>
              <label>
                {t.topicName}
                <input
                  className="forum-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={creating}
                />
              </label>

              <button
                type="submit"
                className="forum-button"
                disabled={creating}
              >
                {creating ? t.creating : t.createTopic}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                disabled={creating}
              >
                {t.cancel}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="forum-new-topic"
              onClick={() => setShowCreateForm(true)}
            >
              {t.newTopic}
            </button>
          ))}

        {/* Обмен бонусами: свёрнутый трей */}
        <details
          style={{
            marginTop: 16,
            border: "1px solid #d5e2dc",
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.94)",
          }}
        >
          <summary
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              color: "#173a33",
              fontSize: 15,
              fontWeight: 700,
              overflowWrap: "anywhere",
              userSelect: "none",
            }}
          >
            {isRu
              ? "Обмен бонусами между участниками"
              : "Bonus exchange between members"}
          </summary>

          {canWrite ? (
            <div
              style={{
                padding: "0 12px 12px",
                minWidth: 0,
                overflowX: "auto",
              }}
            >
              <ForumBonusExchangePanel lang={lang} />
            </div>
          ) : (
            <div
              style={{
                padding: "0 12px 12px",
              }}
            >
              <p>
                {isRu
                  ? "Для обмена бонусами нужны подтверждённая почта, регистрация в форуме и активная сессия форума. Для заблокированных участников обмен недоступен."
                  : "Bonus exchange requires a verified email, forum registration and an active forum session. Banned members cannot exchange bonuses."}
              </p>

              {!forumUser && (
                <Link to="/forum/register">
                  {isRu
                    ? "Зарегистрироваться в форуме"
                    : "Register for the forum"}
                </Link>
              )}

              {forumUser &&
                !forumSessionActive &&
                !forumUser.banned &&
                !forumBanned && (
                  <p>
                    {isRu
                      ? "Войдите в форум с помощью кнопки в шапке форума."
                      : "Enter the forum using the button in the forum header."}
                  </p>
                )}
            </div>
          )}
        </details>

        {error && <p role="alert">{error}</p>}

        {/* Существующий список настоящих тем из API */}
        <section className="forum-card" style={{ marginTop: 24 }}>
          {loading ? (
            <p>{t.topicsLoading}</p>
          ) : topics.length === 0 ? (
            <p>{canWrite ? t.startDiscussion : t.noTopics}</p>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {topics.map((topic) => (
                <article
                  key={topic.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <ForumAuthor author={topic.author} lang={lang} />

                  <h2>
                    <Link to={`/forum/topics/${topic.id}`}>
                      {topic.title}
                    </Link>
                  </h2>

                  <time dateTime={topic.created_at}>
                    {new Date(topic.created_at).toLocaleString(
                      isRu ? "ru-RU" : "en-GB"
                    )}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}