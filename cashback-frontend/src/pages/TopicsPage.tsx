import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=0d6efd&color=fff";

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await fetch("http://localhost:3001/forum/topics");
        const data = await response.json();
        setTopics(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load topics", error);
      } finally {
        setLoading(false);
      }
    };

    loadTopics();
  }, []);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1>Forum</h1>
        <div>
          <Link to="/login" style={{ marginRight: "12px" }}>Login</Link>
          <Link to="/register">Register</Link>
        </div>
      </div>

      {loading ? (
        <p>Loading topics...</p>
      ) : topics.length === 0 ? (
        <p>No topics yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {topics.map((topic) => (
            <div key={topic.id} style={{ border: "1px solid #ddd", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                <img
                  src={topic.author?.avatar_url || defaultAvatar}
                  alt={topic.author?.name || "User"}
                  style={{ width: "42px", height: "42px", borderRadius: "50%" }}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{topic.author?.name || "Unknown user"}</div>
                  <small>{new Date(topic.created_at).toLocaleDateString("ru-RU")}</small>
                </div>
              </div>

              <Link to={`/topic/${topic.id}`} style={{ fontSize: "20px", fontWeight: 700, color: "#0d6efd" }}>
                {topic.title}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
