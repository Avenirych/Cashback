import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ForumHeader from "../components/ForumHeader";
import ForumAuthor from "../components/ForumAuthor";
import { FORUM_API_URL, ForumAuthor as Author } from "../forum";
import { translations } from "../i18n";
import "./Forum.css";

interface ForumTopic { id: number; title: string; created_at: string; author: Author }

export default function TopicsPage({ lang }: { lang: string; onLangChange?: (lang: string) => void }) {
  const { user, token, forumUser, forumSessionActive, forumBanned } = useAuth();
  const canWrite = !!user?.email_verified && !!token && forumSessionActive && !!forumUser && !forumUser.banned && !forumBanned;
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const t = translations[lang.toUpperCase() as keyof typeof translations] ?? translations.EN;

  useEffect(() => {
    const controller = new AbortController();
    setTopics([]);
    setLoading(true);
    setError("");
    fetch(`${FORUM_API_URL}/forum/topics`, {
      headers: { Authorization: "Bearer " + token },
      signal: controller.signal,
    })
      .then(async response => {
        if (!response.ok) throw new Error("Could not load topics");
        const data = await response.json();
        if (!controller.signal.aborted) setTopics(Array.isArray(data) ? data : []);
      })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  const createTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || creating) return;
    if (!title.trim()) { setError(t.enterTopicName); return; }
    setError(""); setCreating(true);
    try {
      const response = await fetch(`${FORUM_API_URL}/forum/topic`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!response.ok) throw new Error(await response.text() || "Failed to create topic");
      const topic = await response.json();
      setTopics(previous => [topic, ...previous]); setTitle(""); setShowCreateForm(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create topic"); }
    finally { setCreating(false); }
  };

  return <div className="forum-page"><main style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
    <Link to="/">{t.backToHome}</Link>
    <ForumHeader lang={lang} />
    {canWrite && (showCreateForm ? <form className="forum-card" onSubmit={createTopic}>
      <label>{t.topicName}<input className="forum-input" value={title} onChange={e => setTitle(e.target.value)} disabled={creating} /></label>
      <button className="forum-button" disabled={creating}>{creating ? t.creating : t.createTopic}</button>
      <button type="button" onClick={() => setShowCreateForm(false)} disabled={creating}>{t.cancel}</button>
    </form> : <button className="forum-new-topic" onClick={() => setShowCreateForm(true)}>{t.newTopic}</button>)}
    {error && <p role="alert">{error}</p>}
    <section className="forum-card" style={{ marginTop: 24 }}>{loading ? <p>{t.topicsLoading}</p> : topics.length === 0 ? <p>{canWrite ? t.startDiscussion : t.noTopics}</p> :
      <div style={{ display: "grid", gap: 16 }}>{topics.map(topic => <article key={topic.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <ForumAuthor author={topic.author} lang={lang} />
        <h2><Link to={`/forum/topics/${topic.id}`}>{topic.title}</Link></h2>
        <time dateTime={topic.created_at}>{new Date(topic.created_at).toLocaleString(lang.toLowerCase() === "ru" ? "ru-RU" : "en-GB")}</time>
      </article>)}</div>}</section>
  </main></div>;
}
