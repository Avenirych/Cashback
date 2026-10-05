import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ForumLogo from "../components/ForumLogo";
import { translations } from "../i18n";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=0d6efd&color=fff";

export default function TopicsPage({ lang, onLangChange }: { lang: string; onLangChange: (lang: string) => void }) {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [error, setError] = useState("");

  const t = translations[lang as keyof typeof translations] ?? translations.EN;

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await fetch("http://localhost:3001/forum/topics");
        const data = await response.json();
        setTopics(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load topics", error);
      } finally {
        setTopicsLoading(false);
      }
    };

    loadTopics();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newTopicTitle.trim()) {
      setError(t.enterTopicName);
      return;
    }

    setCreatingTopic(true);
    try {
      const token = localStorage.getItem("cashback_token");
      const response = await fetch("http://localhost:3001/forum/topic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTopicTitle }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to create topic");
      }

      const newTopic = await response.json();
      setTopics([newTopic, ...topics]);
      setNewTopicTitle("");
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.creating);
    } finally {
      setCreatingTopic(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {t.topicsLoading}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
        <div style={{ marginBottom: "20px" }}>
          <Link to="/" style={{ color: "#0d6efd", textDecoration: "none", fontSize: "14px" }}>
            {t.backToHome}
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            backgroundColor: "white",
            padding: "16px",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ForumLogo size={40} />
            <h1 style={{ margin: 0, fontSize: "32px" }}>{t.forumTitle}</h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {user ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img
                    src={user.avatar_url || defaultAvatar}
                    alt={user.name}
                    style={{ width: "36px", height: "36px", borderRadius: "50%" }}
                  />
                  <span style={{ fontWeight: 500 }}>{user.name}</span>
                </div>
                <button
                  onClick={handleLogout}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  {t.logout}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    padding: "8px 16px",
                    color: "#0d6efd",
                    textDecoration: "none",
                    border: "1px solid #0d6efd",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                >
                  {t.login}
                </Link>
                <Link
                  to="/register"
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#0d6efd",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontSize: "14px",
                  }}
                >
                  {t.register}
                </Link>
              </>
            )}
          </div>
        </div>

        {user && (
          <div style={{ marginBottom: "24px" }}>
            {showCreateForm ? (
              <form
                onSubmit={handleCreateTopic}
                style={{
                  backgroundColor: "white",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #dee2e6",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: 500 }}>
                    {t.topicName}
                  </label>
                  <input
                    type="text"
                    value={newTopicTitle}
                    onChange={(e) => setNewTopicTitle(e.target.value)}
                    placeholder={t.enterTopicName}
                    disabled={creatingTopic}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd",
                      fontSize: "16px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {error && (
                  <div
                    style={{
                      backgroundColor: "#fee",
                      color: "#c33",
                      padding: "12px",
                      borderRadius: "6px",
                      marginBottom: "12px",
                    }}
                  >
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="submit"
                    disabled={creatingTopic}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#0d6efd",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: creatingTopic ? "not-allowed" : "pointer",
                      fontSize: "14px",
                    }}
                  >
                    {creatingTopic ? t.creating : t.createTopic}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setError("");
                    }}
                    disabled={creatingTopic}
                    style={{
                      padding: "12px 24px",
                      backgroundColor: "#e9ecef",
                      color: "#000",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: 500,
                }}
              >
                {t.newTopic}
              </button>
            )}
          </div>
        )}

        <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          {topicsLoading ? (
            <p>{t.topicsLoading}</p>
          ) : topics.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center", padding: "40px 0" }}>
              {user ? t.startDiscussion : t.noTopics}
            </p>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: "12px",
                    padding: "16px",
                    transition: "all 0.3s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                    (e.currentTarget as HTMLElement).style.borderColor = "#0d6efd";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    (e.currentTarget as HTMLElement).style.borderColor = "#ddd";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    <img
                      src={topic.author?.avatar_url || defaultAvatar}
                      alt={topic.author?.name || "User"}
                      style={{ width: "42px", height: "42px", borderRadius: "50%" }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{topic.author?.name || "Unknown user"}</div>
                      <small style={{ color: "#666" }}>
                        {new Date(topic.created_at).toLocaleDateString(lang === "RU" ? "ru-RU" : "en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                  </div>

                  <Link
                    to={`/topic/${topic.id}`}
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color: "#0d6efd",
                      textDecoration: "none",
                    }}
                  >
                    {topic.title}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
