import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface TopicData {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

interface PostData {
  id: number;
  content: string;
  author_id: number;
  created_at: string;
}

export default function Topic() {
  const { id } = useParams();
  const { user } = useAuth();

  const [topic, setTopic] = useState<TopicData | null>(null);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const loadTopic = async () => {
    try {
      const res = await fetch(`http://localhost:3000/topics/${id}`);
      const data = await res.json();
      setTopic(data.topic);
      setPosts(data.posts);
    } catch (err) {
      console.error(err);
      setError("Failed to load topic.");
    }
  };

  useEffect(() => {
    loadTopic();
  }, [id]);

  const sendReply = async () => {
    if (!user) {
      setError("You must be logged in to reply.");
      return;
    }

    if (!reply.trim()) {
      setError("Reply cannot be empty.");
      return;
    }

    try {
      await fetch("http://localhost:3000/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: Number(id),
          content: reply,
          authorId: 1, // временно
        }),
      });

      setReply("");
      await loadTopic();
    } catch (err) {
      console.error(err);
      setError("Failed to send reply.");
    }
  };

  if (!topic) {
    return (
      <div style={{ padding: 40 }}>
        <p>Loading topic...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>{topic.title}</h1>
      <p>{topic.content}</p>

      <h2 style={{ marginTop: 30 }}>Replies</h2>

      {posts.length === 0 ? (
        <p>No replies yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {posts.map((p) => (
            <li
              key={p.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #ddd",
              }}
            >
              <p>{p.content}</p>
              <small>
                by user {p.author_id} at {new Date(p.created_at).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 20 }}>
        {error && <p style={{ color: "red" }}>{error}</p>}

        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write your reply..."
          rows={4}
          style={{ width: "100%", padding: 8 }}
        />

        <button
          onClick={sendReply}
          style={{
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 8,
            background: "#0078ff",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Send Reply
        </button>
      </div>
    </div>
  );
}
