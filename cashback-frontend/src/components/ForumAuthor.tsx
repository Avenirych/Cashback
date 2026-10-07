import { ForumAuthor as Author, forumAvatarUrl } from "../forum";

export default function ForumAuthor({ author, lang }: { author?: Author; lang: string }) {
  const avatar = forumAvatarUrl(author?.avatar_url);
  const ru = lang.toLowerCase() === "ru";
  return <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    {avatar ? <img src={avatar} alt="" width={40} height={40} style={{ borderRadius: "50%" }} /> : <span aria-hidden="true">👤</span>}
    <div>
      <strong>{author?.username || (ru ? "Неизвестный пользователь" : "Unknown user")}</strong>
      {author?.created_at && <small style={{ display: "block" }}>
        {ru ? "На форуме с " : "Joined "}
        {new Date(author.created_at).toLocaleDateString(ru ? "ru-RU" : "en-GB")}
      </small>}
    </div>
  </div>;
}
