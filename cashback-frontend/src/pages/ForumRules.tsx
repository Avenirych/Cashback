import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import content from "../content/forumRules.json";
import ForumRulesAcceptance from "../components/ForumRulesAcceptance";

export type ForumRulesLanguage = "ru" | "en" | "de" | "fr";
export const forumRules = content.rules;
export const rulesLabels = {
  ru: { title: "Правила форума", back: "К форуму", full: "Полные правила", preview: "Краткие правила", agree: "Я ознакомился(-ась) с правилами форума и согласен(-на) их соблюдать" },
  en: { title: "Forum rules", back: "Back to forum", full: "Full rules", preview: "Rules preview", agree: "I agree to the rules. Posts and topics may be deleted. Rule violations may result in deletion of your forum account or a ban." },
  de: { title: "Forenregeln", back: "Zurück zum Forum", full: "Vollständige Regeln", preview: "Forenregeln im Überblick", agree: "Ich habe die Forenregeln gelesen und verpflichte mich, sie einzuhalten. Beiträge und Themen können gelöscht werden. Regelverstöße können zur Löschung meines Forumkontos oder zu einer Sperre führen." },
  fr: { title: "Règles du forum", back: "Retour au forum", full: "Règles complètes", preview: "Aperçu des règles", agree: "J’ai lu les règles du forum et je m’engage à les respecter. Les messages et les sujets peuvent être supprimés. Une infraction peut entraîner la suppression de mon compte de forum ou son blocage." },
};
export function rulesLanguage(value: string): ForumRulesLanguage | null {
  const language = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(forumRules, language) ? language as ForumRulesLanguage : null;
}
export function ForumRulesSections({language}: {language: ForumRulesLanguage}) {
  return <div key={language} lang={language}>
    {forumRules[language].map(([heading, body], index) =>
      <details key={heading} style={{borderBottom: "1px solid #c8bda9", marginBottom: 8}}>
        <summary style={{cursor: "pointer", padding: "14px 4px", fontWeight: 700}}
          aria-controls={"forum-rule-" + language + "-" + index}>{heading}</summary>
        <p id={"forum-rule-" + language + "-" + index} style={{lineHeight: 1.65, padding: "0 4px 12px"}}>{body}</p>
      </details>)}
  </div>;
}
export default function ForumRules() {
  const {lang, setLang} = useLang();
  const language = rulesLanguage(lang);
  if (!language) return <main>{(["ru", "en", "de", "fr"] as const).map(code =>
    <button key={code} onClick={() => setLang(code)}>{code.toUpperCase()}</button>)}</main>;
  return <main lang={language} style={{maxWidth: 800, margin: "auto", padding: 24}}>
    <h1>{rulesLabels[language].title}</h1>
    <Link to="/forum">{rulesLabels[language].back}</Link>
    <ForumRulesSections language={language} />
    <ForumRulesAcceptance />
  </main>;
}
