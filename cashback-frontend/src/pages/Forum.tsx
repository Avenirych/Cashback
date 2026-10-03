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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      const response = await fetch(
        "http://localhost:3000/topics"
      );

      const data = await response.json();

      setTopics(data || []);
    } catch (err) {
      console.error("Failed to load topics", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forum-container">
      <h1>Community Forum</h1>

      <div style={{ marginBottom: "20px" }}>
        <Link
          to="/forum/new"
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "#0078ff",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Create New Topic
        </Link>
      </div>

      {loading ? (
        <p>Loading topics...</p>
      ) : topics.length === 0 ? (
        <p>No topics yet. Be the first to create one!</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
          }}
        >
          {topics.map((topic) => (
            <li
              key={topic.id}
              style={{
                padding: "16px",
                marginBottom: "12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
              }}
            >
              <Link
                to={`/forum/${topic.id}`}
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {topic.title}
              </Link>

              <p style={{ marginTop: "10px" }}>
                {topic.content.length > 160
                  ? topic.content.slice(0, 160) + "..."
                  : topic.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}