import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./ForumRegister.css";

export default function ForumRegister() {
  const { user, updateForumProfile } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [agreeRules, setAgreeRules] = useState(false);
  const [error, setError] = useState("");

  const AVATARS = Array.from({ length: 30 }).map(
    (_, i) => `/assets/avatars/avatar-${i + 1}.png`
  );

  const initials =
    user?.fullName
      ?.split(" ")
      .map((p: string) => p[0]?.toUpperCase())
      .join("") || "U";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError("Forum username is required.");
      return;
    }

    if (!agreeRules) {
      setError("You must agree with the rules.");
      return;
    }

    await updateForumProfile({
      forumUsername: username,
      forumAvatar: avatar,
      agreedRules: true,
    });

    navigate("/forum");
  };

  return (
    <div className="forum-register-container">
      <h1>Forum Registration</h1>

      <p>Email: {user?.email}</p>
      <p>Full name: {user?.fullName}</p>
      <p>Address: {user?.address}</p>

      <form onSubmit={handleSubmit} className="forum-register-form">
        {error && <p className="error">{error}</p>}

        <input
          type="text"
          placeholder="Forum username (unique)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <h3>Select avatar</h3>

        <div className="avatar-grid">
          {AVATARS.map((src) => (
            <img
              key={src}
              src={src}
              alt="avatar"
              className={avatar === src ? "avatar-selected" : ""}
              onClick={() => setAvatar(src)}
            />
          ))}
        </div>

        {!avatar && (
          <div className="initials-preview">
            <p>No avatar selected — initials will be used:</p>
            <div className="initials-circle">{initials}</div>
          </div>
        )}

        <label className="rules-check">
          <input
            type="checkbox"
            checked={agreeRules}
            onChange={(e) => setAgreeRules(e.target.checked)}
          />
          I have read and agree with the forum rules.
        </label>

        <button type="submit">Complete Forum Registration</button>
      </form>
    </div>
  );
}
