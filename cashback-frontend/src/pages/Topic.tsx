import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ForumLogo from "../components/ForumLogo";
import { translations } from "../i18n";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=0d6efd&color=fff";

export default function Topic({ lang, onLangChange }: { lang: string; onLangChange: (lang: string) => void }) {
  const { id } = useParams();
  const { user, token } = useAuth();

  const [topic, setTopic] = useState<any | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const t = translations[lang as keyof typeof translations] ?? translations.EN;

  const loadPosts = useCallback(async () => {
    const response = await fetch(`http://localhost:3001/forum/posts/${id}`);
    const data = await response.json();
    setPosts(Array.isArray(data) ? data : []);
  }, [id]);

  useEffect(() => {
    const loadTopic = async () => {
      const response = await fetch(`http://localhost:3001/forum/topic/${id}`);
      const data = await response.json();
      setTopic(data);
    };

    loadTopic();
    loadPosts();
  }, [id, loadPosts]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setError("");
    setSending(true);

    try {
      const authToken = token || localStorage.getItem("cashback_token");
      const response = await fetch("http://localhost:3001/forum/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          topicId: Number(id),
          content: message,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error ${response.status}: ${text}`);
      }

      setMessage("");
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.send);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
          <Link to="/" style={{ color: "#0d6efd", textDecoration: "none", fontSize: "14px" }}>
            {t.backToHome}
          </Link>
          <span style={{ color: "#ccc" }}>|</span>
          <Link to="/forum" style={{ color: "#0d6efd", textDecoration: "none", fontSize: "14px" }}>
            {t.backToForum}
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <ForumLogo size={40} />
          <Link to="/forum" style={{ fontSize: "32px", fontWeight: 700, color: "#000", textDecoration: "none" }}>
            {t.forumTitle}
          </Link>
        </div>

        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: "24px" }}>
          {topic && (
            <div style={{ marginBottom: "24px", borderBottom: "1px solid #ddd", paddingBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <img
                  src={topic.author?.avatar_url || defaultAvatar}
                  alt={topic.author?.name || "User"}
                  style={{ width: "48px", height: "48px", borderRadius: "50%" }}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{topic.author?.name || "Unknown user"}</div>
                  <small>{new Date(topic.created_at).toLocaleString(lang === "RU" ? "ru-RU" : "en-US")}</small>
                </div>
              </div>

              <h2 style={{ margin: 0 }}>{topic.title}</h2>
            </div>
          )}
        </div>

        {user ? (
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              placeholder={t.writeMessage}
              disabled={sending}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #ddd",
                fontSize: "14px",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={sending}
              style={{
                padding: "10px 20px",
                backgroundColor: "#0d6efd",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "..." : t.send}
            </button>
          </div>
        ) : (
          <p style={{ marginBottom: "12px" }}>
            <Link to="/login">{t.pleaseLogin}</Link> {t.toWriteMessages}
          </p>
        )}

        {error && (
          <div style={{ backgroundColor: "#fee", color: "#c33", padding: "12px", borderRadius: "6px", marginBottom: "12px" }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <div style={{ display: "grid", gap: "12px" }}>
            {posts.length === 0 ? (
              <p>{t.noMessages}</p>
            ) : (
              posts.map((post) => (
                <div key={post.id} style={{ border: "1px solid #ddd", borderRadius: "12px", padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <img
                      src={post.author?.avatar_url || defaultAvatar}
                      alt={post.author?.name || "User"}
                      style={{ width: "36px", height: "36px", borderRadius: "50%" }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{post.author?.name || "Unknown user"}</div>
                      <small>{new Date(post.created_at).toLocaleString(lang === "RU" ? "ru-RU" : "en-US")}</small>
                    </div>
                  </div>
                  <div>{post.content}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
