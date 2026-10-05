import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=0d6efd&color=fff";

export default function Topic() {
  const { id } = useParams();

  const [topic, setTopic] = useState<any | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const loadPosts = async () => {
    const response = await fetch(`http://localhost:3001/forum/posts/${id}`);
    const data = await response.json();
    setPosts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const loadTopic = async () => {
      const response = await fetch(`http://localhost:3001/forum/topic/${id}`);
      const data = await response.json();
      setTopic(data);
    };

    loadTopic();
    loadPosts();
  }, [id]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await fetch("http://localhost:3001/forum/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: 1,
        topicId: Number(id),
        content: message,
      }),
    });

    setMessage("");
    await loadPosts();
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px" }}>
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
              <small>{new Date(topic.created_at).toLocaleDateString("ru-RU")}</small>
            </div>
          </div>

          <h1>Topic #{topic.id}</h1>
          <h2>{topic.title}</h2>
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message"
          style={{ flex: 1, padding: "10px 12px" }}
        />
        <button onClick={sendMessage}>Send</button>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {posts.length === 0 ? (
          <p>No messages yet.</p>
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
                  <small>{new Date(post.created_at).toLocaleDateString("ru-RU")}</small>
                </div>
              </div>
              <div>{post.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
