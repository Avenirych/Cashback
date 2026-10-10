import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { forumAvatarUrl } from "../forum";
import ForumLogo from "./ForumLogo";

export default function ForumHeader({ lang }: { lang: string }) {
  const { forumUser, forumSessionActive, logoutFromForum, forumBanned } = useAuth();
  const ru = lang.toLowerCase() === "ru";
  const avatar = forumAvatarUrl(forumUser?.avatar_url);
  
  return (
    <header
      className="forum-header"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <ForumLogo size={40} />
      <Link to="/forum">
        <h1>{ru ? "Форум" : "Forum"}</h1>
      </Link>
      <Link to="/forum/rules">{ru ? "Правила" : "Rules"}</Link>
      {forumUser && (
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {avatar ? (
            <img
              src={avatar}
              alt=""
              width={40}
              height={40}
              style={{
                borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.7)",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "#0d6efd",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              {forumUser.username.charAt(0).toUpperCase()}
            </div>
          )}
          <strong>{forumUser.username}</strong>
        </span>
      )}
      {forumSessionActive ? (
        <button className="forum-exit" onClick={logoutFromForum}>
          {ru ? "Выйти из форума" : "Exit Forum"}
        </button>
      ) : !forumBanned && !forumUser?.banned ? (
        <Link to="/forum/register">
          {ru ? "Войти в форум / регистрация" : "Enter forum / register"}
        </Link>
      ) : null}
      {!forumSessionActive && (
        <span>{ru ? "Только чтение" : "Read only"}</span>
      )}
    </header>
  );
}