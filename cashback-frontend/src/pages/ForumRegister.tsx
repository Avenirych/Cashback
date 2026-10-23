import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { FORUM_API_URL, validateForumAvatar } from "../forum";
import { ForumRulesSections, rulesLanguage, rulesLabels } from "./ForumRules";
import "./ForumRegister.css";
import messages from "../content/forumRegistration.json";
import {demoReviewMessages} from '../content/demoReviewMessages';

export default function ForumRegister() {
  const { user, forumUser, forumLoading, registerForum, checkForumStatus, forumRegistered, forumBanned } = useAuth();
  const language = rulesLanguage(useLang().lang);
  const demoCopy=language?demoReviewMessages[language]:null;
  const [useAccountName,setUseAccountName]=useState(false);
  const text = (key: keyof typeof messages.en) => language ? messages[language][key] : "";
  const navigate = useNavigate();
  const location = useLocation();
  const reviewNext = new URLSearchParams(location.search).get('next') === '/forum/reviews/new' ? '/forum/reviews/new' : null;
  const [username, setUsername] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [avatar, setAvatar] = useState<File>();
  const [preview, setPreview] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "error">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const validUsername = /^[A-Za-z0-9_]{3,30}$/.test(username);
  const registered = forumRegistered || !!forumUser;


  useEffect(() => {
    if (useAccountName||!validUsername || registered) { setAvailability("idle"); return; }
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
  }, [username, validUsername, registered,useAccountName]);

  useEffect(() => {
    setPreview("");
    if (!avatar || !validateForumAvatar(avatar)) return;
    const reader = new FileReader();
    let active = true;
    reader.onload = () => { if (active && typeof reader.result === "string") setPreview(reader.result); };
    reader.readAsDataURL(avatar);
    return () => { active = false; if (reader.readyState === 1) reader.abort(); };
  }, [avatar]);

  if (!user) return <p>{text("text0")} <Link to={reviewNext ? "/login?next="+encodeURIComponent(reviewNext) : "/login?next=%2Fforum%2Fregister"}>{text("text1")}</Link></p>;
  if (!user.email_verified) return <p>{text("text2")} <Link to={reviewNext ? "/register?next="+encodeURIComponent(reviewNext) : "/verify-email"}>{text("text3")}</Link></p>;
  if (forumLoading && !busy) return <p role="status">{text("text4")}</p>;
  if (forumBanned || forumUser?.banned) return <p role="alert">{text("text5")} <Link to="/forum">{text("text6")}</Link></p>;
  if (success) return <main className="forum-register-container"><h1 role="status">{text("text7")}</h1><Link to={reviewNext || "/forum"} style={{display: "inline-block", padding: "14px 24px", background: "#0d6efd", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 700}}>{text("text8")}</Link></main>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !agreed || !validateForumAvatar(avatar) || (!registered && !useAccountName&&(!validUsername || availability !== "available"))) return;
    setError(""); setBusy(true);
    try {
      await registerForum(forumUser?.username || (useAccountName?'':username), agreed, avatar);
      if(reviewNext)navigate(reviewNext,{replace:true});else setSuccess(true);
    } catch (err) {
      setError((text("text9")) + (err instanceof Error ? err.message : ""));
    } finally { setBusy(false); }
  };
  const reenter = async () => {
    setBusy(true); setError("");
    try { await checkForumStatus(true); navigate(reviewNext || "/forum", { replace: true }); }
    catch { setError(text("text10")); }
    finally { setBusy(false); }
  };

  return <main className="forum-register-container" style={{ padding: 24, maxWidth: 650, margin: "auto", fontSize: 16 }}>
    <h1>{text("text11")}</h1>
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>{text("text12")}<input value={user.firstName || user.name} readOnly style={{ background: "#eee", color: "#666" }} /></label>
      <label>{text("text13")}<input value={user.lastName || ""} readOnly style={{ background: "#eee", color: "#666" }} /></label>
      <label>{text("text14")}<input value={user.email} readOnly style={{ background: "#eee", color: "#666" }} /></label>
      {registered ? <section>
        <p>{text("text15")}{forumUser && `: ${forumUser.username}`}</p>
        <p>{text("text16")}</p>
        <button type="button" disabled={busy} onClick={reenter}>{text("text17")}</button>
      </section> : <>
        <label><input type="checkbox" checked={useAccountName} onChange={e=>setUseAccountName(e.target.checked)} disabled={busy}/>{demoCopy?.defaultName}</label>
        <p>{demoCopy?.defaultHint}</p>
        {!useAccountName&&<label>{text("text18")}<input value={username} onChange={e => { setUsername(e.target.value); setAvailability("idle"); }} required pattern="[A-Za-z0-9_]{3,30}" minLength={3} maxLength={30} disabled={busy} /></label>}
        <p>{text("text19")}</p>
        {validUsername && <p role="status">{({
          idle: "", checking: text("text20"),
          available: text("text21"),
          taken: text("text22"),
          error: text("text23"),
        })[availability]}</p>}
      </>}
      <label>{text("text24")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {
        const file = e.target.files?.[0];
        setAvatar(file);
        setError(validateForumAvatar(file) ? "" : text("text25"));
      }} /></label>
      <p>JPG / PNG / WebP · 500 KB</p>
      {preview && <img src={preview} alt={text("text26")} style={{width: 96, height: 96, objectFit: "cover", borderRadius: "50%"}} />}
      {language && <section aria-label={rulesLabels[language].preview} lang={language}>
        <h2>{rulesLabels[language].title}</h2>
        <ForumRulesSections language={language} />
        <Link to="/forum/rules" target="_blank" rel="noreferrer">{rulesLabels[language].full}</Link>
      </section>}
      <label><input type="checkbox" required checked={agreed} disabled={busy} onChange={e => setAgreed(e.target.checked)} />
        {language && rulesLabels[language].agree}
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy || forumLoading || !agreed || !validateForumAvatar(avatar) || (!registered && !useAccountName&&(!validUsername || availability !== "available"))}>
        {busy ? (text("text27")) : registered ? (text("text28")) : (text("text29"))}
      </button>
      <Link to="/forum">{text("text30")}</Link>
    </form>
  </main>;
}
