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
      title: "Наши услуги — Cashback+",
      intro: "Cashback+ предоставляет набор услуг, которые помогают пользователям экономить, получать вознаграждения и выбирать товары максимально эффективно.",
      cashback: "Кэшбэк от магазинов",
      cashbackText: "Пользователь получает кэшбэк от магазинов при покупках через Cashback+. Процент кэшбэка отображается заранее.",
      video: "Бонусы за просмотр рекламы",
      videoText: "Пользователь может добровольно смотреть рекламные видео и получать бонусы, уменьшающие стоимость будущих покупок.",
      research: "Бонусы за участие в исследованиях",
      researchText: "Пользователь может участвовать в опросах, интервью и тестировании товаров, получая бонусы.",
      direct: "Прямые выплаты от исследовательских компаний",
      directText: "Некоторые компании платят пользователю напрямую. Эти выплаты не проходят через Cashback+.",
      transfer: "Передача бонусов",
      transferText: "Пользователи могут передавать бонусы другим участникам Cashback+.",
      productSelect: "Выбор товара по характеристикам",
      productSelectText: "Cashback+ включает умный инструмент выбора товара. Пользователь может указать характеристики — цену, категорию, рейтинг, срок доставки, репутацию продавца и другие параметры. Система автоматически фильтрует все доступные предложения и показывает наиболее подходящий вариант.",
      productSelectText2: "Этот функционал помогает быстро найти самый выгодный и подходящий товар без ручного поиска.",
      join: "Начните пользоваться услугами Cashback+",
      joinText: "Комбинируйте кэшбэк, бонусы и умный подбор товаров, чтобы делать покупки эффективнее."
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
    </div>
  );
}
