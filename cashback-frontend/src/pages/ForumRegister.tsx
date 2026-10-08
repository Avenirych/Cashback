import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { FORUM_API_URL, validateForumAvatar } from "../forum";
import { forumRules, usePublishedForumRules } from "./ForumRules";
import "./ForumRegister.css";

export default function ForumRegister() {
  const { user, forumUser, forumLoading, registerForum, checkForumStatus, forumRegistered, forumBanned } = useAuth();
  const ru = useLang().lang.toLowerCase() === "ru";
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [avatar, setAvatar] = useState<File>();
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const validUsername = /^[A-Za-z0-9_]{3,30}$/.test(username);
  const registered = forumRegistered || !!forumUser;
  const publishedRules = usePublishedForumRules();

  useEffect(() => {
    if (!validUsername || registered) { setAvailability("idle"); return; }
    let cancelled = false;
    const controller = new AbortController();
    setAvailability("checking");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${FORUM_API_URL}/forum/user/${encodeURIComponent(username)}`, { signal: controller.signal });
        if (!cancelled) setAvailability(response.status === 404 ? "available" : response.ok ? "taken" : "error");
      } catch { if (!cancelled) setAvailability("error"); }
    }, 300);
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [username, validUsername, registered]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => navigate("/forum", { replace: true }), 2000);
    return () => window.clearTimeout(timer);
  }, [success, navigate]);

  if (!user) return null;
  if (forumLoading && !busy) return <p role="status">{ru ? "Загрузка…" : "Loading…"}</p>;
  if (forumBanned || forumUser?.banned) return <p role="alert">{ru ? "Аккаунт форума заблокирован." : "Your forum account is banned."} <Link to="/forum">{ru ? "Читать форум" : "Read forum"}</Link></p>;
  if (success) return <p role="status">{ru ? "Готово! Переход на форум через 2 секунды…" : "Success! Redirecting to the forum in 2 seconds…"}</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !agreed || !validateForumAvatar(avatar) || (!registered && (!validUsername || availability !== "available"))) return;
    setError(""); setBusy(true);
    try {
      await registerForum(forumUser?.username || username, agreed, avatar);
      setSuccess(true);
    } catch (err) {
      setError((ru ? "Не удалось завершить. " : "Could not complete. ") + (err instanceof Error ? err.message : ""));
    } finally { setBusy(false); }
  };
  const reenter = async () => {
    setBusy(true); setError("");
    try { await checkForumStatus(true); navigate("/forum", { replace: true }); }
    catch { setError(ru ? "Не удалось войти. Попробуйте снова." : "Could not enter. Please try again."); }
    finally { setBusy(false); }
  };

  return <main style={{ padding: 24, maxWidth: 650, margin: "auto" }}>
    <h1>{ru ? "Регистрация на форуме" : "Forum registration"}</h1>
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>Email<input value={user.email} readOnly style={{ background: "#eee", color: "#666" }} /></label>
      <label>{ru ? "Имя" : "Name"}<input value={user.name} readOnly style={{ background: "#eee", color: "#666" }} /></label>
      {registered ? <section>
        <p>{ru ? "Аккаунт уже зарегистрирован" : "Account already registered"}{forumUser && `: ${forumUser.username}`}</p>
        <p>{ru ? "Если аватар не загрузился, повторите загрузку ниже или войдите без него. Повторная регистрация не нужна." : "If the avatar upload failed, retry below or enter without it. No duplicate registration is needed."}</p>
        <button type="button" disabled={busy} onClick={reenter}>{ru ? "Войти в форум без загрузки аватара" : "Enter forum without uploading an avatar"}</button>
      </section> : <>
        <label>{ru ? "Псевдоним" : "Username"}<input value={username} onChange={e => { setUsername(e.target.value); setAvailability("idle"); }} required pattern="[A-Za-z0-9_]{3,30}" minLength={3} maxLength={30} disabled={busy} /></label>
        <p>{ru ? "3–30 символов: латинские буквы, цифры и _." : "3–30 characters: Latin letters, digits and _."}</p>
        {validUsername && <p role="status">{({
          idle: "", checking: ru ? "Проверка…" : "Checking…",
          available: ru ? "Псевдоним доступен" : "Username available",
          taken: ru ? "Псевдоним занят" : "Username taken",
          error: ru ? "Не удалось проверить. Измените псевдоним, чтобы повторить." : "Could not check availability. Edit the username to retry.",
        })[availability]}</p>}
      </>}
      <label>{ru ? "Аватар (необязательно)" : "Avatar (optional)"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {
        const file = e.target.files?.[0];
        setAvatar(file);
        setError(validateForumAvatar(file) ? "" : ru ? "Только JPG, PNG или WebP, максимум 500 КБ." : "Only JPG, PNG or WebP, maximum 500 KB.");
      }} /></label>
      <p>JPG / PNG / WebP · 500 KB</p>
      <section aria-label={ru ? "Краткие правила" : "Rules preview"}>
        <h2>{ru ? "Правила" : "Rules"}</h2>
        {publishedRules && <p style={{ whiteSpace: "pre-wrap" }}>{publishedRules[ru ? "ru" : "en"]}</p>}
        {forumRules[ru ? "ru" : "en"].map(([heading, text]) => <p key={heading}><strong>{heading}: </strong>{text}</p>)}
        <Link to="/forum/rules" target="_blank" rel="noreferrer">{ru ? "Полные правила" : "Full rules"}</Link>
      </section>
      <label><input type="checkbox" required checked={agreed} disabled={busy} onChange={e => setAgreed(e.target.checked)} />
        {ru ? "Я согласен с правилами. Сообщения и темы могут быть удалены. Нарушения могут привести к удалению вашего аккаунта форума или блокировке." : "I agree to the rules. Posts and topics may be deleted. Rule violations may result in deletion of your forum account or a ban."}
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || forumLoading || !agreed || !validateForumAvatar(avatar) || (!registered && (!validUsername || availability !== "available"))}>
        {busy ? (ru ? "Сохранение…" : "Saving…") : registered ? (ru ? "Повторить загрузку и войти" : "Retry upload and enter") : (ru ? "Зарегистрироваться на форуме" : "Register for forum")}
      </button>
      <Link to="/forum">{ru ? "Только чтение" : "Read only"}</Link>
    </form>
  </main>;
}
