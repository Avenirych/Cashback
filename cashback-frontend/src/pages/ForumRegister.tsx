import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./ForumRegister.css";

export default function ForumRegister() {
  const { user, updateForumProfile } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [agreeRules, setAgreeRules] = useState(false);
  const [error, setError] = useState("");

  const initials =
    user?.fullName
      ?.split(" ")
      .map((p) => p[0]?.toUpperCase())
      .join("") || "U";

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setError("Forum username is required.");
      return;
    }

    if (!agreeRules) {
      setError("You must agree with the forum rules.");
      return;
    }

    let avatarUrl: string | null = null;

    if (avatarFile) {
      avatarUrl = avatarPreview; // локальный URL, пока без backend
    }

    updateForumProfile({
      forumUsername: username,
      forumAvatar: avatarUrl,
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

        <h3>Upload your avatar</h3>

        <input
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
        />

        {/* Preview */}
        <div style={{ marginTop: 10 }}>
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="avatar preview"
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "#ccc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {initials}
            </div>
          )}
        </div>

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
