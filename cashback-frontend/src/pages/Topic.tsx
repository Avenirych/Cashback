import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ForumHeader from "../components/ForumHeader";
import ForumAuthor from "../components/ForumAuthor";
import { FORUM_API_URL, ForumAuthor as Author } from "../forum";
import { translations } from "../i18n";
import "./Forum.css";

interface ForumPost { id: number; content: string; created_at: string; author: Author }
interface ForumTopic { id: number; title: string; created_at: string; author: Author }

export default function Topic({ lang }: { lang: string; onLangChange?: (lang: string) => void }) {
  const { id } = useParams();
  const { user, token, forumUser, forumSessionActive, forumBanned } = useAuth();
  const canWrite = !!user?.email_verified && !!token && forumSessionActive && !!forumUser && !forumUser.banned && !forumBanned;
  const [topic, setTopic] = useState<ForumTopic | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const t = translations[lang.toUpperCase() as keyof typeof translations] ?? translations.EN;

  useEffect(() => {
    const controller = new AbortController();
    setTopic(null); setPosts([]); setError("");
    const load = async () => {
      const [topicResponse, postsResponse] = await Promise.all([
        fetch(`${FORUM_API_URL}/forum/topic/${id}`, { signal: controller.signal }),
        fetch(`${FORUM_API_URL}/forum/posts/${id}`, { signal: controller.signal }),
      ]);
      if (!topicResponse.ok || !postsResponse.ok) throw new Error("Could not load discussion");
      const [topicData, postsData] = await Promise.all([topicResponse.json(), postsResponse.json()]);
      if (!controller.signal.aborted) { setTopic(topicData); setPosts(Array.isArray(postsData) ? postsData : []); }
    };
    void load().catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [id, refresh]);

  const sendMessage = async () => {
    if (!canWrite || !message.trim() || sending) return;
    setError(""); setSending(true);
    try {
      const response = await fetch(`${FORUM_API_URL}/forum/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ topicId: Number(id), content: message.trim() }),
      });
      if (!response.ok) throw new Error(await response.text() || "Could not send message");
      setMessage(""); setRefresh(previous => previous + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send message"); }
    finally { setSending(false); }
  };

  return <div className="forum-page"><main style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
    <Link to="/">{t.backToHome}</Link> · <Link to="/forum">{t.backToForum}</Link>
    <ForumHeader lang={lang} />
    {topic && <article className="forum-card" style={{ marginBottom: 24 }}><ForumAuthor author={topic.author} lang={lang} /><h2>{topic.title}</h2></article>}
    {canWrite ? <div style={{ display: "flex", gap: 12 }}>
      <input className="forum-input" style={{ flex: 1 }} aria-label={t.writeMessage} value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void sendMessage(); }} placeholder={t.writeMessage} disabled={sending} />
      <button className="forum-button" onClick={sendMessage} disabled={sending}>{sending ? "…" : t.send}</button>
    </div> : !forumBanned && !forumUser?.banned && <p><Link to="/forum/register">{lang.toLowerCase() === "ru" ? "Войти в форум, чтобы писать" : "Enter the forum to write"}</Link></p>}
    {error && <p role="alert">{error}</p>}
    <div className="forum-card" style={{ display: "grid", gap: 12, marginTop: 24 }}>
      {posts.length === 0 ? <p>{t.noMessages}</p> : posts.map(post => <article key={post.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <ForumAuthor author={post.author} lang={lang} />
        <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString(lang.toLowerCase() === "ru" ? "ru-RU" : "en-GB")}</time>
        <p>{post.content}</p>
      </article>)}
    </div>
  </main></div>;
}
