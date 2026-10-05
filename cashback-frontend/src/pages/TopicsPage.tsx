import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=0d6efd&color=fff";

export default function TopicsPage() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);

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

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Загрузка...</div>;
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          borderBottom: "1px solid #eee",
          paddingBottom: "16px",
        }}
      >
        <h1 style={{ margin: 0 }}>Forum</h1>

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
                }}
              >
                Выход
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
                }}
              >
                Вход
              </Link>
              <Link
                to="/register"
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#0d6efd",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                }}
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>

      {topicsLoading ? (
        <p>Загрузка тем...</p>
      ) : topics.length === 0 ? (
        <p>No topics yet.</p>
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
                    {new Date(topic.created_at).toLocaleDateString("ru-RU", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
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
  );
}
