import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function Topic() {
  const { id } = useParams();

  const [posts, setPosts] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const loadPosts = async () => {
    const response = await fetch(
      `http://localhost:3001/posts/topic/${id}`
    );

    const data = await response.json();

    setPosts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadPosts();
  }, [id]);

  const sendMessage = async () => {
    if (!message.trim()) return;

    await fetch("http://localhost:3001/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicId: Number(id),
        content: message,
      }),
    });

    setMessage("");

    await loadPosts();
  };

  return (
    <div style={{ maxWidth: "900px", margin: "30px auto" }}>
      <Link to="/">
        ← Back to Topics
      </Link>

      <h1 style={{ marginTop: "20px" }}>
        Topic #{id}
      </h1>

      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "10px",
        }}
      >
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message..."
          style={{
            flex: 1,
            padding: "10px",
          }}
        />

        <button onClick={sendMessage}>
          Send
        </button>
      </div>

      {posts.map((post) => (
        <div
          key={post.id}
          style={{
            border: "1px solid #ddd",
            padding: "12px",
            marginBottom: "10px",
            borderRadius: "8px",
            backgroundColor: "#f8f8f8",
          }}
        >
          <strong>Message #{post.id}</strong>

          <div
            style={{
              marginTop: "8px",
            }}
          >
            {post.content}
          </div>
        </div>
      ))}
    </div>
  );
}