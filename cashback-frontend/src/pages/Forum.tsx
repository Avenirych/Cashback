import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Forum.css";

interface Topic {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

interface ForumProps {
  lang: string;
}

export default function Forum({ lang }: ForumProps) {
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    fetch("http://localhost:3000/topics")
      .then((res) => res.json())
      .then((data) => setTopics(data))
      .catch((err) => console.error("Failed to load topics", err));
  }, []);

  return (
    <div className="forum-container">
      <h1>Community Forum</h1>

      <div style={{ marginBottom: 20 }}>
        <Link
          to="/forum/new"
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            background: "#0078ff",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Create New Topic
        </Link>
      </div>

      {topics.length === 0 ? (
        <p>No topics yet. Be the first to create one!</p>
      ) : (
        <ul className="forum-topics-list">
          {topics.map((t) => (
            <li key={t.id} className="forum-topic-item">
              <Link to={`/forum/${t.id}`} className="forum-topic-title">
                {t.title}
              </Link>
              <p className="forum-topic-preview">
                {t.content.length > 160
                  ? t.content.slice(0, 160) + "..."
                  : t.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
