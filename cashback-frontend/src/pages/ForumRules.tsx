import { useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import content from "../content/forumRules.json";
import ForumRulesAcceptance from "../components/ForumRulesAcceptance";
import "./ForumRules.css";

export type ForumRulesLanguage = "ru" | "en" | "de" | "fr";
export const forumRules = content.rules;
export const rulesLabels = {
  ru: { title: content.document.ru.title, back: "К форуму", full: "Полные правила", preview: "Краткие правила", agree: "Я ознакомился(-ась) с правилами форума и согласен(-на) их соблюдать" },
  en: { title: content.document.en.title, back: "Back to forum", full: "Full rules", preview: "Rules preview", agree: "I agree to the rules. Posts and topics may be deleted. Rule violations may result in deletion of your forum account or a ban." },
  de: { title: content.document.de.title, back: "Zurück zum Forum", full: "Vollständige Regeln", preview: "Forenregeln im Überblick", agree: "Ich habe die Forenregeln gelesen und verpflichte mich, sie einzuhalten. Beiträge und Themen können gelöscht werden. Regelverstöße können zur Löschung meines Forumkontos oder zu einer Sperre führen." },
  fr: { title: content.document.fr.title, back: "Retour au forum", full: "Règles complètes", preview: "Aperçu des règles", agree: "J’ai lu les règles du forum et je m’engage à les respecter. Les messages et les sujets peuvent être supprimés. Une infraction peut entraîner la suppression de mon compte de forum ou son blocage." },
};
export function rulesLanguage(value: string): ForumRulesLanguage | null {
  const language = value.toLowerCase();
  return Object.prototype.hasOwnProperty.call(forumRules, language) ? language as ForumRulesLanguage : null;
}
function RuleBody({body}: {body: string}) {
  const lines = body.split("\n");
  const blocks = [];
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].startsWith("- ")) {
      const first = index;
      const items = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(<li key={index}>{lines[index].slice(2)}</li>);
        index++;
      }
      index--;
      blocks.push(<ul key={first}>{items}</ul>);
    } else if (lines[index]) {
      blocks.push(<p key={index}>{lines[index]}</p>);
    }
  }
  return <>{blocks}</>;
}
function ForumRulePanel({heading, body, id, number}: {heading: string; body: string; id: string; number: number}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(previous => !previous);
  return <details className="forum-rule-panel" open={open}>
    <summary id={id + "-heading"} role="button" tabIndex={0}
      aria-expanded={open} aria-controls={id}
      onClick={event => { event.preventDefault(); toggle(); }}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault(); toggle();
        }
      }}>
      <span>{number}. {heading}</span><span className="forum-rule-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div className="forum-rule-body" id={id} aria-labelledby={id + "-heading"}>
      <RuleBody body={body} />
    </div>
  </details>;
}
export function ForumRulesSections({language}: {language: ForumRulesLanguage}) {
  return <div className="forum-rule-sections" key={language} lang={language}>
    {forumRules[language].map(([heading, body], index) =>
      <ForumRulePanel key={heading} heading={heading} body={body} number={index + 1}
        id={"forum-rule-" + language + "-" + index} />)}
  </div>;
}
export default function ForumRules() {
  const {lang, setLang} = useLang();
  const language = rulesLanguage(lang);
  if (!language) return <main>{(["ru", "en", "de", "fr"] as const).map(code =>
    <button key={code} onClick={() => setLang(code)}>{code.toUpperCase()}</button>)}</main>;
  return <main className="forum-rules-page" lang={language}>
    <h1>{rulesLabels[language].title}</h1>
    <p className="forum-rules-date">{content.document[language].effectiveDate}</p>
    <Link to="/forum">{rulesLabels[language].back}</Link>
    <ForumRulesSections language={language} />
    <ForumRulesAcceptance />
  </main>;
}
