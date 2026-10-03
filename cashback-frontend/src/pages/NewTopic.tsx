import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NewTopic() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to create a topic.");
      return;
    }

    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          authorId: 1,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create topic");
      }

      navigate("/forum");
    } catch (err) {
      console.error(err);
      setError("Failed to create topic.");
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h1>Create New Topic</h1>

      {error && (
        <p style={{ color: "red" }}>
          {error}
        </p>
      )}

      <form
        onSubmit={submit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxWidth: "700px",
        }}
      >
        <input
          type="text"
          placeholder="Topic title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            padding: "10px",
            fontSize: "16px",
          }}
        />

        <textarea
          placeholder="Topic content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          style={{
            padding: "10px",
            fontSize: "16px",
          }}
        />

        <button
          type="submit"
          style={{
            padding: "10px 16px",
            borderRadius: "8px",
            background: "#0078ff",
            color: "#ffffff",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Publish Topic
        </button>
      </form>
    </div>
  );
}