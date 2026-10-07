import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { FORUM_API_URL } from "../forum";

export const forumRules = {
  en: [
    ["General rules", "Be civil and respectful. Report safety concerns to moderators; do not retaliate or impersonate others."],
    ["Privacy and identity", "Use your forum username, not another person's identity. Do not publish personal data, credentials or private communications without permission. Your username, avatar and forum joining date are public; your account email and name are not forum author details."],
    ["Posting guidelines", "Stay on topic and check information before posting. Disclose commercial interests and respect intellectual property. Share only content you have permission to share."],
    ["Prohibited content", "No harassment, hate, threats, abuse, illegal material, exploitation, spam, scams, deceptive promotions or infringing content."],
    ["UK context and advice", "Follow applicable UK law and any other laws that apply to you. Discussion is general information, not legal, financial or professional advice. Verify claims independently. These community rules do not assert legal compliance, determine legal rights or replace professional advice."],
    ["Moderation", "Moderators may review reports and remove posts and topics. Contact support about moderation decisions; do not evade moderation."],
    ["Consequences", "Rule violations may result in deletion of your forum account or a ban. Posts and topics may also be deleted. A ban prevents posting, not reading. Forum access is separate from your Cashback account."],
    ["Account deletion", "Rule violations may result in permanent deletion of your forum account. Do not assume a deleted forum account or its content can be recovered. This warning concerns your forum account, which is separate from your main Cashback account."],
  ],
  ru: [
    ["Общие правила", "Будьте вежливы и уважайте других. Сообщайте о проблемах безопасности модераторам; не мстите и не выдавайте себя за других."],
    ["Конфиденциальность и личность", "Используйте псевдоним форума, не выдавайте себя за другого человека. Не публикуйте чужие персональные данные, пароли или переписку без разрешения. Псевдоним, аватар и дата вступления в форум публичны; email и имя основного аккаунта не отображаются у авторов."],
    ["Правила публикации", "Пишите по теме и проверяйте информацию перед публикацией. Раскрывайте коммерческие интересы, уважайте авторские права и публикуйте только разрешённые материалы."],
    ["Запрещённый контент", "Запрещены травля, ненависть, угрозы, оскорбления, незаконные материалы, эксплуатация, спам, мошенничество, вводящая в заблуждение реклама и нарушение авторских прав."],
    ["Контекст Великобритании и советы", "Соблюдайте применимое законодательство Великобритании и другие применимые к вам законы. Обсуждения — общая информация, а не юридическая, финансовая или профессиональная консультация. Проверяйте утверждения самостоятельно. Правила не гарантируют соответствие закону, не определяют юридические права и не заменяют консультацию специалиста."],
    ["Модерация", "Модераторы могут рассматривать жалобы и удалять сообщения и темы. По вопросам модерации обращайтесь в поддержку; не обходите решения модераторов."],
    ["Последствия", "Нарушения могут привести к удалению вашего аккаунта форума или блокировке. Сообщения и темы также могут быть удалены. Блокировка запрещает публикации, но не чтение. Доступ к форуму отделён от аккаунта Cashback."],
    ["Удаление аккаунта", "Нарушения правил могут привести к окончательному удалению вашего аккаунта форума. Не рассчитывайте на восстановление удалённого аккаунта форума или его содержимого. Предупреждение касается аккаунта форума, который отделён от основного аккаунта Cashback."],
  ],
};

export function usePublishedForumRules() {
  const [published, setPublished] = useState<{ en: string; ru: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${FORUM_API_URL}/forum/rules`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && typeof data.en === "string" && data.en.trim() && typeof data.ru === "string" && data.ru.trim()) {
          setPublished(data);
        }
      }).catch(() => {});
    return () => controller.abort();
  }, []);
  return published;
}

export default function ForumRules() {
  const ru = useLang().lang.toLowerCase() === "ru";
  const published = usePublishedForumRules();
  return <main style={{ maxWidth: 800, margin: "auto", padding: 24 }}>
    <h1>{ru ? "Правила форума" : "Forum rules"}</h1>
    <Link to="/forum">{ru ? "К форуму" : "Back to forum"}</Link>
    {(["en", "ru"] as const).map(language => <section key={language} lang={language}>
      <h2>{language === "en" ? "English" : "Русский"}</h2>
      {published && <p style={{ whiteSpace: "pre-wrap" }}>{published[language]}</p>}
      {forumRules[language].map(([heading, body]) => <section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}
    </section>)}
  </main>;
}
