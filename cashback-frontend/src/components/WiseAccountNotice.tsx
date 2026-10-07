import React from "react";

type NoticeLang = "en" | "ru" | "de" | "fr";

interface NoticeMessages {
  title: string;
  recommendation: string;
  accountType: string;
  fees: string;
  register: string;
  existingAccount: string;
}

const messages: Record<NoticeLang, NoticeMessages> = {
  en: {
    title: "Before completing the Wise details form",
    recommendation:
      "Before joining the bonus programme, we recommend setting up a suitable Wise account if you do not already have one. Enter the email associated with that account in the Wise email field.",
    accountType:
      "Wise Business is intended for business use. If you are participating as an individual customer, check whether a Personal account is more appropriate. Select your actual account type in the form.",
    fees:
      "Before registering, review Wise's availability, verification requirements and current fees for your country and currency. Registration does not guarantee lower fees or a successful transfer.",
    register: "Open the Wise registration page ↗",
    existingAccount:
      "Already have a suitable Wise account? You do not need to register again. Never enter your Wise password, verification codes or card details on this website.",
  },
  ru: {
    title: "Перед заполнением реквизитов Wise",
    recommendation:
      "Перед присоединением к программе получения бонусов рекомендуем оформить подходящий аккаунт Wise, если у вас его ещё нет. В поле Email аккаунта Wise укажите почту, связанную с этим аккаунтом.",
    accountType:
      "Wise Business предназначен для использования в бизнесе. Если вы участвуете как частный покупатель, проверьте, подходит ли вам личный аккаунт Personal. В форме выберите фактический тип вашего аккаунта.",
    fees:
      "Перед регистрацией ознакомьтесь с доступностью Wise, требованиями к проверке и действующими комиссиями для вашей страны и валюты. Регистрация не гарантирует уменьшение комиссий или успешный перевод.",
    register: "Открыть регистрацию на сайте Wise ↗",
    existingAccount:
      "Уже есть подходящий аккаунт Wise? Повторная регистрация не нужна. Никогда не вводите на нашем сайте пароль Wise, коды подтверждения или данные банковской карты.",
  },
  de: {
    title: "Vor dem Ausfüllen der Wise-Kontodaten",
    recommendation:
      "Bevor Sie am Bonusprogramm teilnehmen, empfehlen wir Ihnen, ein geeignetes Wise-Konto einzurichten, falls Sie noch keines haben. Geben Sie im Wise-E-Mail-Feld die mit diesem Konto verknüpfte E-Mail-Adresse ein.",
    accountType:
      "Wise Business ist für geschäftliche Zwecke vorgesehen. Wenn Sie als Privatkunde teilnehmen, prüfen Sie, ob ein Personal-Konto besser geeignet ist. Wählen Sie im Formular Ihren tatsächlichen Kontotyp aus.",
    fees:
      "Prüfen Sie vor der Registrierung die Verfügbarkeit, Verifizierungsanforderungen und aktuellen Gebühren für Ihr Land und Ihre Währung. Die Registrierung garantiert weder niedrigere Gebühren noch eine erfolgreiche Überweisung.",
    register: "Wise-Registrierung öffnen ↗",
    existingAccount:
      "Sie haben bereits ein geeignetes Wise-Konto? Eine erneute Registrierung ist nicht erforderlich. Geben Sie auf dieser Website niemals Ihr Wise-Passwort, Bestätigungscodes oder Kartendaten ein.",
  },
  fr: {
    title: "Avant de renseigner vos coordonnées Wise",
    recommendation:
      "Avant de rejoindre le programme de bonus, nous vous recommandons de créer un compte Wise adapté si vous n'en avez pas encore. Dans le champ e-mail Wise, indiquez l'adresse associée à ce compte.",
    accountType:
      "Wise Business est destiné à un usage professionnel. Si vous participez en tant que particulier, vérifiez si un compte Personal est plus adapté. Sélectionnez votre type de compte réel dans le formulaire.",
    fees:
      "Avant de vous inscrire, consultez la disponibilité de Wise, les exigences de vérification et les frais en vigueur pour votre pays et votre devise. L'inscription ne garantit ni des frais réduits ni la réussite d'un transfert.",
    register: "Ouvrir l'inscription sur Wise ↗",
    existingAccount:
      "Vous avez déjà un compte Wise adapté ? Une nouvelle inscription n'est pas nécessaire. Ne saisissez jamais votre mot de passe Wise, vos codes de vérification ou vos coordonnées de carte sur ce site.",
  },
};

export default function WiseAccountNotice({ lang }: { lang: string }) {
  const key = lang.toLowerCase() as NoticeLang;
  const t = messages[key] || messages.en;

  return (
    <aside
      aria-labelledby="wise-account-notice-title"
      style={{
        margin: "24px 0",
        padding: "20px",
        border: "1px solid #b8d7c4",
        borderLeft: "4px solid #24734b",
        borderRadius: "12px",
        background: "#f0f8f3",
        color: "#163c29",
        boxSizing: "border-box",
        overflowWrap: "anywhere",
      }}
    >
      <h2
        id="wise-account-notice-title"
        style={{
          margin: "0 0 12px",
          fontSize: "20px",
          lineHeight: 1.4,
        }}
      >
        {t.title}
      </h2>

      <p style={{ margin: "0 0 12px" }}>{t.recommendation}</p>
      <p style={{ margin: "0 0 12px" }}>{t.accountType}</p>
      <p style={{ margin: "0 0 16px" }}>{t.fees}</p>

      <a
        href="https://wise.com/register"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          padding: "10px 14px",
          border: "1px solid #24734b",
          borderRadius: "8px",
          background: "#ffffff",
          color: "#145332",
          fontWeight: 700,
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
      >
        {t.register}
      </a>

      <p style={{ margin: "16px 0 0", fontSize: "14px" }}>
        {t.existingAccount}
      </p>
    </aside>
  );
}