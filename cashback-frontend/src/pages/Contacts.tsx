import React from "react";
import FAQ from "./FAQ";
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

  if (lang.toLowerCase() === "ru") return <FAQ
    lang={lang}
    title="Связаться с Cashback+"
    introduction={<>
      <p>Мы будем рады помочь по вопросам использования платформы Cashback+, начисления кэшбэка, бонусных программ, участия в исследованиях, работы учётной записи и другим вопросам, связанным с функционированием сервиса.</p>
      <p>Команда Cashback+ работает полностью в дистанционном формате. Личный приём посетителей не осуществляется, если иное не согласовано заранее в письменной форме.
</p>
    </>}
    items={[
      {question: "Служба поддержки пользователей", answer: <>
        <p>По вопросам использования платформы, начислений, учётной записи, технических проблем и работы сервиса:</p>
        <p><strong>Email:</strong> <a href="mailto:support@cashbackplus.uk">support@cashbackplus.uk</a></p>
        <p>При обращении рекомендуется указывать адрес электронной почты, связанный с вашей учётной записью, а также подробное описание возникшей ситуации.</p>
        <p>Мы стремимся отвечать на обращения пользователей в разумные сроки с учётом сложности запроса и текущей загрузки службы поддержки.</p>
      </>},
      {question: "Конфиденциальность и защита данных", answer: <>
        <p>По вопросам обработки персональных данных, реализации прав субъекта данных, удаления данных, исправления информации и иным вопросам, связанным с конфиденциальностью:</p>
        <p><strong>Email:</strong> <a href="mailto:privacy@cashbackplus.uk">privacy@cashbackplus.uk</a></p>
        <p>Запросы, связанные с персональными данными, рассматриваются в соответствии с требованиями законодательства Великобритании о защите данных.</p>
      </>},
      {question: "Юридические вопросы", answer: <>
        <p>По вопросам юридической документации, официальных уведомлений, соблюдения законодательства и иным правовым вопросам:</p>
        <p><strong>Email:</strong> <a href="mailto:legal@cashbackplus.uk">legal@cashbackplus.uk</a></p>
      </>},
      {question: "Информация о компании", answer: <>
        <p><strong>Наименование компании:</strong> Cashback Plus Ltd</p>
        <p><strong>Страна регистрации:</strong> Соединённое Королевство</p>
        <p><strong>Юрисдикция:</strong> Англия и Уэльс</p>
        <p><strong>Регистрационный номер компании:</strong> [Company Number]</p>
        <p><strong>Юридический адрес:</strong> [Registered Office Address]</p>
        <p>После регистрации компании рекомендуется заменить данные в квадратных скобках на фактическую информацию из реестра Companies House.</p>
      </>},
      {question: "Обращения по начислениям и вознаграждениям", answer: <>
        <p>Если ваш вопрос связан с кэшбэком, бонусами, исследовательскими программами или подтверждением покупок, пожалуйста, по возможности укажите:</p>
        <ul><li>дату совершения покупки или действия;</li><li>наименование магазина или партнёра;</li><li>номер заказа (если применимо);</li><li>описание проблемы;</li><li>скриншоты или иные подтверждающие материалы (при наличии).</li></ul>
        <p>Это поможет ускорить рассмотрение обращения.</p>
      </>},
      {question: "Безопасность аккаунта", answer: <>
        <p>Если вы считаете, что доступ к вашей учётной записи мог получить кто-либо кроме вас, рекомендуем незамедлительно обратиться в службу поддержки.</p>
        <p>Для обеспечения безопасности пользователей Cashback+ никогда не запрашивает пароли, коды подтверждения, полные банковские реквизиты или иную конфиденциальную информацию посредством электронной почты.</p>
      </>},
      {question: "Форма обратной связи", answer: <>
        <p>Для удобства пользователей на платформе может использоваться форма обратной связи.</p>
        <p>Пожалуйста, не указывайте в сообщениях:</p>
        <ul><li>пароли;</li><li>одноразовые коды подтверждения;</li><li>полные данные банковских карт;</li><li>иную информацию, раскрытие которой не требуется для обработки вашего запроса.</li></ul>
        <form className="contacts-form">
            <input type="text" placeholder={L.formName} />
            <textarea placeholder={L.formMessage}></textarea>
            <button type="submit">{L.formSend}</button>
          </form>
      </>},
      {question: "Жалобы и споры", answer: <>
        <p>Если вы считаете, что ваш вопрос не был решён должным образом через стандартные каналы поддержки, вы можете направить обращение по адресу:</p>
        <p><strong><a href="mailto:legal@cashbackplus.uk">legal@cashbackplus.uk</a></strong></p>
        <p>Каждое обращение рассматривается индивидуально в соответствии с внутренними процедурами Cashback+ и применимым законодательством.</p>
      </>},
      {question: "Важная информация", answer: <>
        <p>Cashback+ является информационной платформой и программой потребительских вознаграждений.</p>
        <p>Cashback+ не является:</p>
        <ul><li>банком;</li><li>платёжной организацией;</li><li>эмитентом электронных денег;</li><li>инвестиционной платформой;</li><li>страховой организацией;</li><li>поставщиком финансовых услуг.</li></ul>
        <p>По вопросам качества товаров, доставки, возвратов, гарантийного обслуживания и исполнения обязательств по покупке пользователю следует обращаться непосредственно к соответствующему продавцу, который является стороной договора купли-продажи.</p>
      </>},
      {question: "Часы обработки обращений", answer: <>
        <p>Обращения пользователей принимаются круглосуточно через электронную почту и доступные формы связи.</p>
        <p>Обработка запросов осуществляется в рабочее время службы поддержки. Фактическое время ответа может зависеть от сложности обращения, количества поступающих запросов и необходимости взаимодействия с партнёрами платформы.</p>
      </>}
    ]}
  />;

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
