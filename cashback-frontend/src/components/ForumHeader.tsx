import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { forumAvatarUrl } from "../forum";
import ForumLogo from "./ForumLogo";

export default function ForumHeader({ lang }: { lang: string }) {
  const { forumUser, forumSessionActive, logoutFromForum, forumBanned } = useAuth();
  const ru = lang.toLowerCase() === "ru";
  const avatar = forumAvatarUrl(forumUser?.avatar_url);
  return <header className="forum-header" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
    <ForumLogo size={40} />
    <Link to="/forum"><h1>{ru ? "Форум" : "Forum"}</h1></Link>
    <Link to="/forum/rules">{ru ? "Правила" : "Rules"}</Link>
    {forumUser && <span>{avatar && <img src={avatar} alt="" width={36} height={36} />}{forumUser.username}</span>}
    {forumSessionActive ? <button className="forum-exit" onClick={logoutFromForum}>{ru ? "Выйти из форума" : "Exit Forum"}</button> :
      !forumBanned && !forumUser?.banned && <Link to="/forum/register">{ru ? "Войти в форум / регистрация" : "Enter forum / register"}</Link>}
    {!forumSessionActive && <span>{ru ? "Только чтение" : "Read only"}</span>}
  </header>;
}
