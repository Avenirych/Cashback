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
      const response = await fetch(
        `http://localhost:3000/topics/${id}`
      );

      const data = await response.json();

      setTopic(data.topic);
      setPosts(data.posts || []);
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicId: Number(id),
          content: reply,
          authorId: 1,
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
      <div style={{ padding: "40px" }}>
        <p>Loading topic...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>{topic.title}</h1>

      <p>{topic.content}</p>

      <h2 style={{ marginTop: "30px" }}>
        Replies
      </h2>

      {posts.length === 0 ? (
        <p>No replies yet.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
          }}
        >
          {posts.map((post) => (
            <li
              key={post.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #ddd",
              }}
            >
              <p>{post.content}</p>

              <small>
                User {post.author_id} •{" "}
                {new Date(post.created_at).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: "20px" }}>
        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}

        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write your reply..."
          rows={5}
          style={{
            width: "100%",
            padding: "10px",
          }}
        />

        <button
          onClick={sendReply}
          style={{
            marginTop: "10px",
            padding: "10px 16px",
            borderRadius: "8px",
            background: "#0078ff",
            color: "#ffffff",
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