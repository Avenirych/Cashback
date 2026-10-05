import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./ForumRegister.css";

export default function ForumRegister() {
  const { user, logout } = useAuth();
  const [error, setError] = useState("");

  if (!user) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>You must be logged in to register for the forum.</p>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement forum registration
    setError("Forum registration coming soon");
  };

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Forum Registration</h1>

      <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
        <p>Email: {user.email}</p>
        <p>Name: {user.name}</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
        {error && <p style={{ color: "red" }}>{error}</p>}

        <button
          type="submit"
          style={{
            padding: "10px 16px",
            backgroundColor: "#0d6efd",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Register for Forum
        </button>
      </form>
    </div>
  );
}
