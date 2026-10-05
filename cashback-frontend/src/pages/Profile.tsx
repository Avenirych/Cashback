import React from "react";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return <div>Not logged in</div>;
  }

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Profile</h1>

      <div style={{ marginBottom: "24px" }}>
        <p>Email: {user.email}</p>
        <p>Name: {user.name}</p>
        <p>Balance: {user.balance || 0}</p>
      </div>

      {user.avatar_url && (
        <div>
          <img
            src={user.avatar_url}
            alt="avatar"
            style={{ width: "100px", height: "100px", borderRadius: "50%" }}
          />
        </div>
      )}
    </div>
  );
}
