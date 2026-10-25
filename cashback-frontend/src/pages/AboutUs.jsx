import React from "react";
import "./AboutUs.css";

export default function AboutUs({ lang }) {
  const t = {
    en: {
      title: "About Us — Cashback+",
      who: "Who We Are",
      whoText1: "Cashback+ is a UK-based rewards platform that combines cashback, video bonuses, and research bonuses, allowing users to reduce the cost of purchases up to 100%.",
      whoText2: "Cashback+ is operated by Cashback Plus Ltd, registered in the United Kingdom.",
      mission: "Our Mission",
      missionText: "Our mission is to make rewards transparent, fair, and accessible to everyone.",
      values: "Our Values",
      value1: "Transparency — users always see exact reward amounts in advance.",
      value2: "Honesty — no hidden fees or misleading mechanics.",
      value3: "Safety — Cashback+ does not store user funds.",
      value4: "Community — bonuses can be transferred between users.",
      value5: "Responsibility — we protect the system from fraud.",
      how: "How Cashback+ Works",
      cashback: "1. Retail Cashback",
      cashbackText: "Retailers pay a commission for referred purchases, and Cashback+ shares a percentage with the user.",
      ads: "2. Video Bonuses",
      adsText: "Users may watch ads voluntarily and receive bonuses equal to £1 per bonus when compensating purchases.",
      research: "3. Research Bonuses",
      researchText: "Research companies pay commissions for user participation, and Cashback+ shares part of it as bonuses.",
      direct: "Direct Research Payments",
      directText: "Direct payments do not pass through Cashback+ and are not shown in the balance.",
      transfer: "Bonus Transfers",
      transferText: "Users may transfer bonuses to other Cashback+ members.",
      join: "Join Cashback+",
      joinText: "Start receiving fair rewards for your purchases, attention, and participation."
    },

    ru: {
      "title": "О нас — Cashback+",
      "sections": [
        {
          "title": "Кто мы",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Cashback+ — это платформа потребительских вознаграждений, которая помогает пользователям получать кэшбэк и дополнительные бонусы за участие в партнёрских программах, рекламных кампаниях и исследованиях."
            },
            {
              "type": "paragraph",
              "text": "Платформа управляется компанией Cashback Plus Ltd, зарегистрированной в Великобритании."
            },
            {
              "type": "paragraph",
              "text": "Cashback+ не является банком, платёжной системой, инвестиционной платформой, эмитентом электронных денег или поставщиком финансовых услуг. Все вознаграждения предоставляются исключительно в рамках программы лояльности и пользовательской активности."
            }
          ]
        },
        {
          "title": "Наша миссия",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Мы стремимся сделать программы вознаграждений более прозрачными, понятными и доступными для широкого круга пользователей."
            },
            {
              "type": "paragraph",
              "text": "Наша цель состоит в том, чтобы пользователи могли получать дополнительную ценность от своих повседневных покупок и цифровой активности, понимая условия начисления вознаграждений и правила участия в программе."
            }
          ]
        },
        {
          "title": "Наши ценности",
          "blocks": [
            {
              "type": "heading",
              "text": "Прозрачность"
            },
            {
              "type": "paragraph",
              "text": "Пользователь получает информацию о размере потенциального вознаграждения и условиях его начисления до участия в программе."
            },
            {
              "type": "paragraph",
              "text": "Мы стараемся предоставлять понятные правила, доступные описания предложений и своевременно информировать пользователей об изменениях условий."
            },
            {
              "type": "heading",
              "text": "Честность"
            },
            {
              "type": "paragraph",
              "text": "Все существенные условия участия, ограничения программы и применимые правила публикуются в соответствующих разделах платформы."
            },
            {
              "type": "paragraph",
              "text": "Мы не используем скрытые комиссии и стремимся обеспечивать понятную коммуникацию между пользователями, партнёрами и платформой."
            },
            {
              "type": "heading",
              "text": "Безопасность"
            },
            {
              "type": "paragraph",
              "text": "Cashback+ не принимает пользовательские депозиты, не предоставляет платёжные услуги и не хранит денежные средства клиентов в качестве финансового учреждения."
            },
            {
              "type": "paragraph",
              "text": "Вознаграждения и бонусы, доступные на платформе, относятся исключительно к программе лояльности и не являются банковскими, инвестиционными или страховыми продуктами."
            },
            {
              "type": "heading",
              "text": "Сообщество"
            },
            {
              "type": "paragraph",
              "text": "Мы развиваем сообщество пользователей, заинтересованных в разумном потреблении, выгодных покупках и совместном использовании возможностей программы."
            },
            {
              "type": "paragraph",
              "text": "Некоторые бонусы могут передаваться другим пользователям в соответствии с действующими Правилами активности и установленными ограничениями платформы."
            }
          ]
        },
        {
          "title": "Как работает Cashback+",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Cashback+ объединяет несколько видов вознаграждений в рамках единой программы."
            },
            {
              "type": "heading",
              "text": "Кэшбэк от магазинов"
            },
            {
              "type": "paragraph",
              "text": "Многие интернет-магазины выплачивают партнёрское вознаграждение за привлечённых покупателей."
            },
            {
              "type": "paragraph",
              "text": "В рамках отдельных предложений Cashback+ может передавать пользователю часть такого вознаграждения в виде кэшбэка после выполнения условий соответствующего предложения и подтверждения покупки партнёром."
            },
            {
              "type": "paragraph",
              "text": "Размер кэшбэка зависит от условий конкретного магазина, категории товаров и действующих акций."
            },
            {
              "type": "heading",
              "text": "Бонусы за просмотр рекламы"
            },
            {
              "type": "paragraph",
              "text": "Пользователи могут участвовать в рекламных программах, доступных на платформе, и получать бонусные вознаграждения за выполнение предусмотренных условий."
            },
            {
              "type": "paragraph",
              "text": "Размер доступного бонуса определяется правилами конкретной рекламной кампании, условиями партнёра и правилами программы Cashback+."
            },
            {
              "type": "paragraph",
              "text": "Участие в рекламных программах является добровольным."
            },
            {
              "type": "heading",
              "text": "Бонусы за участие в исследованиях"
            },
            {
              "type": "paragraph",
              "text": "Некоторые партнёры проводят маркетинговые и исследовательские опросы, в которых пользователи могут принимать участие."
            },
            {
              "type": "paragraph",
              "text": "В случае успешного завершения исследования пользователь может получить предусмотренное вознаграждение в соответствии с условиями конкретного исследования."
            },
            {
              "type": "paragraph",
              "text": "Размер и доступность таких вознаграждений определяются партнёрами и могут различаться для разных исследований."
            },
            {
              "type": "heading",
              "text": "Выплаты от внешних партнёров"
            },
            {
              "type": "paragraph",
              "text": "В отдельных случаях партнёры могут осуществлять выплаты пользователям напрямую."
            },
            {
              "type": "paragraph",
              "text": "Такие выплаты не проходят через Cashback+ и не отображаются в балансе программы, если иное не указано в условиях соответствующего предложения."
            },
            {
              "type": "paragraph",
              "text": "За обработку подобных выплат отвечает организация, которая осуществляет выплату пользователю."
            },
            {
              "type": "heading",
              "text": "Передача бонусов между пользователями"
            },
            {
              "type": "paragraph",
              "text": "Платформа может предоставлять возможность передачи бонусных единиц между участниками программы."
            },
            {
              "type": "paragraph",
              "text": "Такая передача осуществляется исключительно внутри программы Cashback+ и не является банковским переводом, денежным переводом, платёжной услугой или финансовой операцией."
            },
            {
              "type": "paragraph",
              "text": "Платформа вправе устанавливать ограничения, лимиты и дополнительные требования к таким операциям."
            }
          ]
        },
        {
          "title": "Почему пользователи выбирают Cashback+",
          "blocks": [
            {
              "type": "list",
              "items": [
                "Дополнительная выгода при покупках у партнёров.",
                "Возможность участвовать в рекламных кампаниях и исследованиях.",
                "Единая система учёта вознаграждений.",
                "Понятные правила участия и начисления бонусов.",
                "Развитие пользовательского сообщества."
              ]
            }
          ]
        },
        {
          "title": "Важная информация",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Cashback+ является программой потребительских вознаграждений."
            },
            {
              "type": "paragraph",
              "text": "Размер, доступность и сроки начисления вознаграждений зависят от условий партнёрских программ, активности пользователя, результатов проверки транзакций и соблюдения правил платформы."
            },
            {
              "type": "paragraph",
              "text": "Вознаграждения не являются банковским вкладом, инвестиционным продуктом, электронными деньгами, страховым продуктом или платёжным инструментом."
            },
            {
              "type": "paragraph",
              "text": "Участие в программе не гарантирует получение определённого размера вознаграждения."
            }
          ]
        }
      ],
      "join": "Присоединяйтесь к Cashback+",
      "joinText": "Присоединяйтесь к Cashback+ и получайте доступ к программам вознаграждений, которые помогут сделать ваши покупки и цифровую активность более выгодными при соблюдении условий платформы."
    },

    fr: {
      title: "À propos de nous — Cashback+",
      who: "Qui nous sommes",
      whoText1: "Cashback+ est une plateforme britannique qui combine cashback, bonus vidéo et bonus d’études pour réduire le coût des achats jusqu’à 100%.",
      whoText2: "Cashback+ est exploité par Cashback Plus Ltd, enregistré au Royaume-Uni.",
      mission: "Notre mission",
      missionText: "Notre mission est de rendre les récompenses transparentes, équitables et accessibles à tous.",
      values: "Nos valeurs",
      value1: "Transparence — les utilisateurs voient toujours les montants exacts à l’avance.",
      value2: "Honnêteté — aucun frais caché ou mécanisme trompeur.",
      value3: "Sécurité — Cashback+ ne stocke pas les fonds des utilisateurs.",
      value4: "Communauté — les bonus peuvent être transférés entre utilisateurs.",
      value5: "Responsabilité — nous protégeons le système contre la fraude.",
      how: "Comment fonctionne Cashback+",
      cashback: "1. Cashback des commerçants",
      cashbackText: "Les commerçants paient une commission, et Cashback+ en partage une partie avec l’utilisateur.",
      ads: "2. Bonus vidéo",
      adsText: "Les utilisateurs peuvent regarder des publicités et recevoir des bonus équivalents à £1 lors de la compensation.",
      research: "3. Bonus d’études",
      researchText: "Les entreprises d’études paient une commission, et Cashback+ en partage une partie avec l’utilisateur.",
      direct: "Paiements directs",
      directText: "Les paiements directs ne passent pas par Cashback+ et ne sont pas affichés dans le solde.",
      transfer: "Transfert de bonus",
      transferText: "Les utilisateurs peuvent transférer des bonus à d’autres membres.",
      join: "Rejoignez Cashback+",
      joinText: "Commencez à recevoir des récompenses équitables pour vos achats et votre participation."
    },

    de: {
      title: "Über uns — Cashback+",
      who: "Wer wir sind",
      whoText1: "Cashback+ ist eine britische Plattform, die Cashback, Videoboni und Forschungsboni kombiniert, um die Kosten von Einkäufen bis zu 100% zu reduzieren.",
      whoText2: "Cashback+ wird von Cashback Plus Ltd betrieben, registriert im Vereinigten Königreich.",
      mission: "Unsere Mission",
      missionText: "Unsere Mission ist es, Belohnungen transparent, fair und für alle zugänglich zu machen.",
      values: "Unsere Werte",
      value1: "Transparenz — Nutzer sehen immer die genauen Beträge im Voraus.",
      value2: "Ehrlichkeit — keine versteckten Gebühren oder irreführenden Mechaniken.",
      value3: "Sicherheit — Cashback+ speichert keine Gelder der Nutzer.",
      value4: "Gemeinschaft — Boni können zwischen Nutzern übertragen werden.",
      value5: "Verantwortung — wir schützen das System vor Betrug.",
      how: "Wie Cashback+ funktioniert",
      cashback: "1. Händler-Cashback",
      cashbackText: "Händler zahlen eine Provision, und Cashback+ teilt einen Teil davon mit dem Nutzer.",
      ads: "2. Videoboni",
      adsText: "Nutzer können freiwillig Werbung ansehen und Boni erhalten, die £1 entsprechen.",
      research: "3. Forschungsboni",
      researchText: "Forschungsunternehmen zahlen Provisionen, und Cashback+ teilt einen Teil davon mit dem Nutzer.",
      direct: "Direkte Zahlungen",
      directText: "Direkte Zahlungen laufen nicht über Cashback+ und erscheinen nicht im Guthaben.",
      transfer: "Bonusübertragungen",
      transferText: "Nutzer können Boni an andere Mitglieder übertragen.",
      join: "Cashback+ beitreten",
      joinText: "Beginnen Sie, faire Belohnungen für Ihre Einkäufe und Teilnahme zu erhalten."
    }
  };

  const L = t[lang] || t.en;

  return (
    <div className="about-container">
      <h1>{L.title}</h1>

      {lang === "ru" ? (
        <>
          {L.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) =>
                block.type === "heading" ? (
                  <h3 key={index}>{block.text}</h3>
                ) : block.type === "list" ? (
                  <ul key={index}>
                    {block.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : (
                  <p key={index}>{block.text}</p>
                )
              )}
            </section>
          ))}
        </>
      ) : (
        <>
      <section>
        <h2>{L.who}</h2>
        <p>{L.whoText1}</p>
        <p>{L.whoText2}</p>
      </section>

      <section>
        <h2>{L.mission}</h2>
        <p>{L.missionText}</p>
      </section>

      <section>
        <h2>{L.values}</h2>
        <ul>
          <li>{L.value1}</li>
          <li>{L.value2}</li>
          <li>{L.value3}</li>
          <li>{L.value4}</li>
          <li>{L.value5}</li>
        </ul>
      </section>

      <section>
        <h2>{L.how}</h2>
        <h3>{L.cashback}</h3>
        <p>{L.cashbackText}</p>

        <h3>{L.ads}</h3>
        <p>{L.adsText}</p>

        <h3>{L.research}</h3>
        <p>{L.researchText}</p>

        <h4>{L.direct}</h4>
        <p>{L.directText}</p>

        <h3>{L.transfer}</h3>
        <p>{L.transferText}</p>
      </section>

        </>
      )}

      <section>
        <h2>{L.join}</h2>
        <p>{L.joinText}</p>
      </section>
    </div>
  );
}
