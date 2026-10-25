import React from "react";
import "./Services.css";

export default function Services({ lang }) {
  const t = {
    en: {
      title: "Our Services — Cashback+",
      intro: "Cashback+ provides a set of services designed to help users save money, earn rewards, and choose products more effectively.",
      cashback: "Retail Cashback",
      cashbackText: "Users receive cashback from retailers when purchases are made through Cashback+. The cashback percentage is shown before purchase.",
      video: "Video Bonus Rewards",
      videoText: "Users may watch advertising videos voluntarily and receive bonuses that reduce the cost of future purchases.",
      research: "Research Participation Bonuses",
      researchText: "Users may participate in surveys, interviews, and product testing to earn bonuses.",
      direct: "Direct Research Payments",
      directText: "Some research companies pay users directly. These payments do not pass through Cashback+.",
      transfer: "Bonus Transfers",
      transferText: "Users may transfer bonuses to other Cashback+ members.",
      productSelect: "Product Selection by Characteristics",
      productSelectText: "Cashback+ includes a smart product selection tool. Users can choose a product by specifying characteristics such as price, category, rating, delivery time, seller reputation, and more. The system automatically filters all available offers and shows the best match.",
      productSelectText2: "This feature helps users quickly find the most profitable and suitable product without manually checking dozens of listings.",
      join: "Start Using Cashback+ Services",
      joinText: "Combine cashback, bonuses, and smart product selection to make your shopping more efficient."
    },

    ru: {
      "title": "Как это работает — Cashback+",
      "sections": [
        {
          "title": "Cashback+ в нескольких словах",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Cashback+ объединяет программы кэшбэка, бонусные активности и инструменты поиска товаров в единой экосистеме."
            },
            {
              "type": "paragraph",
              "text": "Пользователи могут получать вознаграждения за покупки у партнёров, участие в рекламных кампаниях и исследованиях, а также использовать инструменты платформы для поиска и сравнения доступных предложений."
            },
            {
              "type": "paragraph",
              "text": "Размер и доступность вознаграждений зависят от условий конкретных предложений, активности пользователя и правил платформы."
            }
          ]
        },
        {
          "title": "Кэшбэк от покупок",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Многие магазины и онлайн-сервисы сотрудничают с партнёрскими платформами и выплачивают вознаграждение за привлечённых покупателей."
            },
            {
              "type": "paragraph",
              "text": "При совершении покупок через партнёрские предложения Cashback+ пользователь может получить кэшбэк в соответствии с условиями конкретного магазина или акции."
            },
            {
              "type": "paragraph",
              "text": "Перед переходом к покупке платформа отображает размер потенциального кэшбэка и основные условия предложения."
            },
            {
              "type": "paragraph",
              "text": "Начисление кэшбэка выполняется после подтверждения покупки партнёром и соблюдения всех требований соответствующего предложения."
            },
            {
              "type": "paragraph",
              "text": "В отдельных случаях начисление может быть отклонено или скорректировано, например при возврате товара, отмене заказа или нарушении условий партнёра."
            }
          ]
        },
        {
          "title": "Бонусы за участие в рекламных программах",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Некоторые партнёры предоставляют пользователям возможность добровольно участвовать в рекламных кампаниях, размещённых на платформе Cashback+."
            },
            {
              "type": "paragraph",
              "text": "За выполнение условий таких кампаний пользователю могут начисляться бонусные единицы программы."
            },
            {
              "type": "paragraph",
              "text": "Размер бонусов определяется условиями конкретной рекламной кампании и может различаться в зависимости от предложения."
            },
            {
              "type": "paragraph",
              "text": "Участие в рекламных программах является полностью добровольным."
            },
            {
              "type": "paragraph",
              "text": "Получение бонусов не требует совершения покупки, если иное прямо не указано в условиях соответствующей кампании."
            }
          ]
        },
        {
          "title": "Бонусы за участие в исследованиях",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Платформа может предоставлять доступ к исследованиям, опросам, тестированию продуктов и другим исследовательским программам, проводимым партнёрами."
            },
            {
              "type": "paragraph",
              "text": "Если пользователь соответствует критериям исследования и успешно выполняет его условия, ему может быть начислено предусмотренное вознаграждение."
            },
            {
              "type": "paragraph",
              "text": "Условия участия, доступность исследований и размер вознаграждения устанавливаются организаторами соответствующего исследования."
            },
            {
              "type": "paragraph",
              "text": "Отдельные исследования могут иметь ограничения по возрасту, месту проживания, интересам или иным параметрам, необходимым для формирования исследовательской выборки."
            }
          ]
        },
        {
          "title": "Выплаты от внешних исследовательских компаний",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Некоторые исследовательские организации могут осуществлять выплаты напрямую пользователям."
            },
            {
              "type": "paragraph",
              "text": "Такие выплаты производятся соответствующей организацией самостоятельно и не обрабатываются платформой Cashback+."
            },
            {
              "type": "paragraph",
              "text": "Порядок, сроки и способы получения таких выплат определяются исключительно организацией, которая осуществляет выплату."
            },
            {
              "type": "paragraph",
              "text": "Cashback+ не выступает стороной финансовых отношений между пользователем и такой организацией."
            }
          ]
        },
        {
          "title": "Передача бонусов между пользователями",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Cashback+ может предоставлять возможность передачи бонусных единиц между участниками программы."
            },
            {
              "type": "paragraph",
              "text": "Передача осуществляется исключительно внутри платформы и регулируется действующими Правилами активности."
            },
            {
              "type": "paragraph",
              "text": "Передаваемые бонусы не являются денежными средствами, банковским переводом, платёжной услугой, электронными деньгами или инвестиционным активом."
            },
            {
              "type": "paragraph",
              "text": "Платформа вправе устанавливать ограничения на передачу бонусов, включая лимиты, требования к статусу пользователя и иные меры защиты программы."
            }
          ]
        },
        {
          "title": "Поиск и сравнение товаров",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Cashback+ предоставляет инструменты поиска и фильтрации товаров по различным параметрам, включая цену, категорию, характеристики, рейтинг и другие доступные данные."
            },
            {
              "type": "paragraph",
              "text": "Используя систему фильтрации, пользователь может быстрее находить предложения, соответствующие выбранным критериям."
            },
            {
              "type": "paragraph",
              "text": "Результаты поиска формируются на основе информации, доступной платформе на момент запроса."
            },
            {
              "type": "paragraph",
              "text": "Cashback+ не гарантирует отображение всех предложений рынка, полной информации обо всех продавцах или наиболее низкой цены на каждый товар."
            },
            {
              "type": "paragraph",
              "text": "Окончательное решение о покупке пользователь принимает самостоятельно на основании собственных предпочтений и оценки предложений."
            }
          ]
        },
        {
          "title": "Единая система вознаграждений",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Различные виды активности на платформе могут приносить пользователю вознаграждения в соответствии с действующими правилами программы."
            },
            {
              "type": "paragraph",
              "text": "Такие вознаграждения могут включать:"
            },
            {
              "type": "list",
              "items": [
                "кэшбэк от покупок;",
                "бонусы за участие в рекламных кампаниях;",
                "бонусы за участие в исследованиях;",
                "иные виды поощрений, предусмотренные правилами платформы."
              ]
            },
            {
              "type": "paragraph",
              "text": "Условия начисления и использования различных видов вознаграждений могут отличаться."
            }
          ]
        },
        {
          "title": "Прозрачность программы",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Мы стремимся к тому, чтобы пользователи понимали:"
            },
            {
              "type": "list",
              "items": [
                "за какие действия доступны вознаграждения;",
                "какие условия необходимо выполнить;",
                "какие ограничения действуют для конкретного предложения;",
                "каким образом рассчитываются начисления."
              ]
            },
            {
              "type": "paragraph",
              "text": "Информация о действующих условиях размещается непосредственно рядом с соответствующими предложениями либо в связанных документах платформы."
            }
          ]
        },
        {
          "title": "Почему пользователи выбирают Cashback+",
          "blocks": [
            {
              "type": "list",
              "items": [
                "Возможность получать кэшбэк от партнёрских предложений.",
                "Дополнительные бонусы за участие в доступных программах.",
                "Инструменты поиска и сравнения товаров.",
                "Единая система учёта вознаграждений.",
                "Понятные правила участия.",
                "Акцент на прозрачности и информированности пользователей."
              ]
            }
          ]
        },
        {
          "title": "Важная информация",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Cashback+ является программой потребительских вознаграждений и информационной платформой."
            },
            {
              "type": "paragraph",
              "text": "Размер, доступность и сроки начисления вознаграждений зависят от условий партнёров, результатов проверки транзакций, активности пользователя и соблюдения правил программы."
            },
            {
              "type": "paragraph",
              "text": "Вознаграждения, бонусы и внутренние баллы платформы не являются банковскими вкладами, инвестиционными продуктами, электронными деньгами, платёжными инструментами или страховыми продуктами."
            },
            {
              "type": "paragraph",
              "text": "Использование платформы не гарантирует получение определённого размера вознаграждения или достижение конкретного уровня экономии."
            }
          ]
        },
        {
          "title": "Начните использовать Cashback+",
          "blocks": [
            {
              "type": "paragraph",
              "text": "Изучайте предложения партнёров, участвуйте в доступных программах, получайте вознаграждения и используйте возможности Cashback+ для более осознанного подхода к покупкам и цифровой активности."
            }
          ]
        }
      ]
    },

    fr: {
      title: "Nos services — Cashback+",
      intro: "Cashback+ propose des services permettant aux utilisateurs d’économiser, de gagner des récompenses et de choisir des produits plus efficacement.",
      cashback: "Cashback des commerçants",
      cashbackText: "Les utilisateurs reçoivent du cashback lorsque les achats sont effectués via Cashback+. Le pourcentage est affiché avant l’achat.",
      video: "Bonus vidéo",
      videoText: "Les utilisateurs peuvent regarder des vidéos publicitaires et recevoir des bonus réduisant le coût des achats.",
      research: "Bonus d’études",
      researchText: "Les utilisateurs peuvent participer à des enquêtes, interviews et tests de produits pour gagner des bonus.",
      direct: "Paiements directs",
      directText: "Certaines entreprises paient directement les utilisateurs. Ces paiements ne passent pas par Cashback+.",
      transfer: "Transfert de bonus",
      transferText: "Les utilisateurs peuvent transférer des bonus à d’autres membres.",
      productSelect: "Sélection de produit par caractéristiques",
      productSelectText: "Cashback+ inclut un outil intelligent de sélection de produits. L’utilisateur peut définir des critères — prix, catégorie, note, délai de livraison, réputation du vendeur, etc. Le système filtre automatiquement toutes les offres disponibles et affiche la meilleure correspondance.",
      productSelectText2: "Cette fonctionnalité permet de trouver rapidement le produit le plus avantageux sans vérifier manuellement des dizaines d’annonces.",
      join: "Commencez à utiliser les services Cashback+",
      joinText: "Combinez cashback, bonus et sélection intelligente pour optimiser vos achats."
    },

    de: {
      title: "Unsere Dienstleistungen — Cashback+",
      intro: "Cashback+ bietet Dienstleistungen, die Nutzern helfen, Geld zu sparen, Belohnungen zu erhalten und Produkte effizienter auszuwählen.",
      cashback: "Händler-Cashback",
      cashbackText: "Nutzer erhalten Cashback von Händlern, wenn Einkäufe über Cashback+ getätigt werden. Der Prozentsatz wird vor dem Kauf angezeigt.",
      video: "Videoboni",
      videoText: "Nutzer können freiwillig Werbevideos ansehen und Boni erhalten, die die Kosten zukünftiger Einkäufe reduzieren.",
      research: "Forschungsboni",
      researchText: "Nutzer können an Umfragen, Interviews und Produkttests teilnehmen und Boni verdienen.",
      direct: "Direkte Zahlungen",
      directText: "Einige Unternehmen zahlen Nutzern direkt. Diese Zahlungen laufen nicht über Cashback+.",
      transfer: "Bonusübertragungen",
      transferText: "Nutzer können Boni an andere Mitglieder übertragen.",
      productSelect: "Produktsuche nach Merkmalen",
      productSelectText: "Cashback+ enthält ein intelligentes Produktauswahl-Tool. Nutzer können Merkmale wie Preis, Kategorie, Bewertung, Lieferzeit und Verkäuferreputation angeben. Das System filtert automatisch alle verfügbaren Angebote und zeigt die beste Übereinstimmung.",
      productSelectText2: "Diese Funktion hilft, schnell das profitabelste und passendste Produkt zu finden, ohne manuell suchen zu müssen.",
      join: "Nutzen Sie die Cashback+ Dienstleistungen",
      joinText: "Kombinieren Sie Cashback, Boni und intelligente Produktauswahl, um effizienter einzukaufen."
    }
  };

  const L = t[lang] || t.en;

  return (
    <div className="services-container">
      <h1>{L.title}</h1>

      {lang === "ru" ? (
        <>
          {L.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) =>
                block.type === "list" ? (
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
        <p>{L.intro}</p>
      </section>

      <section>
        <h2>{L.cashback}</h2>
        <p>{L.cashbackText}</p>
      </section>

      <section>
        <h2>{L.video}</h2>
        <p>{L.videoText}</p>
      </section>

      <section>
        <h2>{L.research}</h2>
        <p>{L.researchText}</p>
      </section>

      <section>
        <h2>{L.direct}</h2>
        <p>{L.directText}</p>
      </section>

      <section>
        <h2>{L.transfer}</h2>
        <p>{L.transferText}</p>
      </section>

      <section>
        <h2>{L.productSelect}</h2>
        <p>{L.productSelectText}</p>
        <p>{L.productSelectText2}</p>
      </section>

      <section>
        <h2>{L.join}</h2>
        <p>{L.joinText}</p>
      </section>
        </>
      )}
    </div>
  );
}
