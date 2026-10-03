import React from "react";
import { useAuth } from "../context/AuthContext";
import "./Profile.css";

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="profile-container">
        <h1>You are not logged in</h1>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h1>User Profile</h1>

      <p>Email: {user.email}</p>
      <p>Full name: {user.fullName}</p>
      <p>Address: {user.address}</p>

      <h2>Forum</h2>
      <p>Username: {user.forumUsername || "Not set"}</p>
      <p>Rules agreed: {user.agreedRules ? "Yes" : "No"}</p>

      {user.forumAvatar && (
        <img src={user.forumAvatar} alt="avatar" className="profile-avatar" />
      )}
    </div>
  );
}
