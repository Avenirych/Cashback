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
      title: "О нас — Cashback+",
      who: "Кто мы",
      whoText1: "Cashback+ — британская платформа умных покупок, объединяющая кэшбэк, бонусы за просмотр рекламы и бонусы за участие в исследованиях.",
      whoText2: "Cashback+ управляется компанией Cashback Plus Ltd, зарегистрированной в Великобритании.",
      mission: "Наша миссия",
      missionText: "Наша миссия — сделать вознаграждения прозрачными, честными и доступными каждому.",
      values: "Наши ценности",
      value1: "Прозрачность — пользователь всегда видит точные суммы заранее.",
      value2: "Честность — никаких скрытых комиссий.",
      value3: "Безопасность — Cashback+ не хранит деньги пользователей.",
      value4: "Сообщество — бонусы можно передавать другим пользователям.",
      value5: "Ответственность — мы защищаем систему от мошенничества.",
      how: "Как работает Cashback+",
      cashback: "1. Кэшбэк от магазинов",
      cashbackText: "Магазины платят комиссию за покупки, и Cashback+ передаёт пользователю процент этой комиссии.",
      ads: "2. Бонусы за просмотр рекламы",
      adsText: "Пользователь может смотреть рекламу и получать бонусы, равные £1 при компенсации покупок.",
      research: "3. Бонусы за участие в исследованиях",
      researchText: "Исследовательские компании платят комиссию за участие, и Cashback+ передаёт часть этой комиссии пользователю.",
      direct: "Прямые выплаты от исследовательских компаний",
      directText: "Прямые выплаты не проходят через Cashback+ и не отображаются в балансе.",
      transfer: "Передача бонусов",
      transferText: "Пользователи могут передавать бонусы другим участникам Cashback+.",
      join: "Присоединяйтесь к Cashback+",
      joinText: "Начните получать честные вознаграждения за покупки, внимание и участие."
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

      <section>
        <h2>{L.join}</h2>
        <p>{L.joinText}</p>
      </section>
    </div>
  );
}
