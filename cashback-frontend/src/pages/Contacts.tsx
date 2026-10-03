import React from "react";
import "./Contacts.css";

interface ContactsProps {
  lang: string;
}

export default function Contacts({ lang }: ContactsProps) {
  const t = {
    en: {
      title: "Contacts",
      intro: "You can contact Cashback+ using the following details.",
      email: "Email",
      support: "Support",
      address: "Registered Address (UK)",
      addressText: "Cashback Plus Ltd, London, United Kingdom",
      formTitle: "Contact Form",
      formName: "Your Name",
      formMessage: "Message",
      formSend: "Send",
    },
    ru: {
      title: "Контакты",
      intro: "Вы можете связаться с Cashback+ по следующим контактам.",
      email: "Email",
      support: "Поддержка",
      address: "Юридический адрес (Великобритания)",
      addressText: "Cashback Plus Ltd, London, United Kingdom",
      formTitle: "Форма обратной связи",
      formName: "Ваше имя",
      formMessage: "Сообщение",
      formSend: "Отправить",
    },
    fr: {
      title: "Contacts",
      intro: "Vous pouvez contacter Cashback+ via les informations suivantes.",
      email: "Email",
      support: "Support",
      address: "Adresse enregistrée (UK)",
      addressText: "Cashback Plus Ltd, Londres, Royaume-Uni",
      formTitle: "Formulaire de contact",
      formName: "Votre nom",
      formMessage: "Message",
      formSend: "Envoyer",
    },
    de: {
      title: "Kontakt",
      intro: "Sie können Cashback+ über die folgenden Angaben kontaktieren.",
      email: "Email",
      support: "Support",
      address: "Registrierte Adresse (UK)",
      addressText: "Cashback Plus Ltd, London, Vereinigtes Königreich",
      formTitle: "Kontaktformular",
      formName: "Ihr Name",
      formMessage: "Nachricht",
      formSend: "Senden",
    },
  };

  const L = t[lang] || t.en;

  return (
    <div className="contacts-container">
      <h1>{L.title}</h1>
      <p>{L.intro}</p>

      <section>
        <h2>{L.email}</h2>
        <p>support@cashbackplus.uk</p>
      </section>

      <section>
        <h2>{L.support}</h2>
        <p>+44 20 1234 5678</p>
      </section>

      <section>
        <h2>{L.address}</h2>
        <p>{L.addressText}</p>
      </section>

      <section>
        <h2>{L.formTitle}</h2>
        <form className="contacts-form">
          <input type="text" placeholder={L.formName} />
          <textarea placeholder={L.formMessage}></textarea>
          <button type="submit">{L.formSend}</button>
        </form>
      </section>
    </div>
  );
}
