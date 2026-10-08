import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";

type ResearchCard = {
  id: number;
  title: string;
  summary: string;
  goals: string;
  participants: string;
  conditions: string;
  earnings: string;
};

const directionPaths: Record<number, string> = {
  1: "surveys",
  2: "focus-groups",
  3: "ux",
  4: "mystery-shopping",
  5: "health",
  6: "b2b",
  7: "diaries",
  8: "communities",
  9: "academic",
  10: "experts",
};

const content = {
  RU: {
    pageTitle: "Research Bonuses",
    pageSubtitle:
      "Выберите направление исследования. Ниже кратко описаны цели, кто может участвовать и какие условия/вознаграждения обычно встречаются.",
    cards: [
      {
        id: 1,
        title: "1) Маркетинговые опросы (Paid Surveys)",
        summary:
          "Самый распространенный формат: анкеты о покупках, привычках, финансах, авто и других темах.",
        goals:
          "Цель: собрать мнения потребителей, проверить гипотезы и улучшить продукты/рекламу.",
        participants:
          "Участники: широкая аудитория пользователей, иногда узкие сегменты по возрасту, региону или интересам.",
        conditions:
          "Условия: заполнение анкеты, прохождение квалификации (скрининг), честные и полные ответы.",
        earnings:
          "Заработок: обычно £0.5–£20 за опрос, для узких аудиторий может быть выше.",
      },
      {
        id: 2,
        title: "2) Фокус-группы",
        summary:
          "Групповые обсуждения продукта, интерфейса или рекламы, часто в Zoom.",
        goals:
          "Цель: получить глубокую качественную обратную связь и понять мотивацию пользователей.",
        participants:
          "Участники: потребители из целевой аудитории, а также специалисты (врачи, IT, финансы и т.д.).",
        conditions:
          "Условия: участие в сессии по времени, активное обсуждение, соблюдение инструкций модератора.",
        earnings:
          "Заработок: обычно £30–£300 за сессию; у редких специалистов может достигать £500–£1000.",
      },
      {
        id: 3,
        title: "3) UX-исследования сайтов и приложений",
        summary:
          "Тестирование интерфейсов: регистрация, покупка, навигация, комментарии по удобству.",
        goals:
          "Цель: выявить проблемы UX/UI и повысить конверсию/удобство продукта.",
        participants:
          "Участники: обычные пользователи и целевые группы с нужным опытом.",
        conditions:
          "Условия: выполнение сценариев, иногда запись экрана и голосовых комментариев.",
        earnings:
          "Заработок: ориентировочно £5–£100 за тест.",
      },
      {
        id: 4,
        title: "4) Тайный покупатель (Mystery Shopping Online)",
        summary:
          "Проверка клиентского сервиса через реальный пользовательский путь.",
        goals:
          "Цель: оценить качество обслуживания, скорость ответа поддержки и работу процесса заказа.",
        participants:
          "Участники: пользователи, готовые пройти заданный сценарий взаимодействия с сервисом.",
        conditions:
          "Условия: оформить заказ/обращение в поддержку, заполнить отчет по результатам.",
        earnings:
          "Заработок: фиксированный гонорар; часто предусмотрена компенсация расходов.",
      },
      {
        id: 5,
        title: "5) Медицинские исследования",
        summary:
          "Высокооплачиваемые проекты с пациентами, родственниками пациентов и иногда здоровыми добровольцами.",
        goals:
          "Цель: собрать данные о лечении, симптомах, опыте пациентов и восприятии медицинских решений.",
        participants:
          "Участники: люди с конкретными диагнозами, их родственники, иногда контрольные группы.",
        conditions:
          "Условия: строгий скрининг, подтверждение критериев участия, соблюдение протоколов исследования.",
        earnings:
          "Заработок: обычно £50–£2000+ в зависимости от сложности и редкости профиля.",
      },
      {
        id: 6,
        title: "6) Исследования среди профессионалов (B2B Research)",
        summary:
          "Интервью и опросы среди специалистов: руководителей, бухгалтеров, программистов, владельцев бизнеса.",
        goals:
          "Цель: понять рынок, процессы принятия решений и профессиональные потребности.",
        participants:
          "Участники: подтвержденные специалисты и эксперты в своей области.",
        conditions:
          "Условия: верификация опыта/должности, интервью по профильным темам.",
        earnings:
          "Заработок: обычно £50–£500 за интервью; один из самых выгодных сегментов.",
      },
      {
        id: 7,
        title: "7) Онлайн-дневники (Diary Studies)",
        summary:
          "Длительное наблюдение: участник несколько дней/недель фиксирует поведение и опыт.",
        goals:
          "Цель: изучить реальные привычки пользователей в динамике, а не в одномоментном опросе.",
        participants:
          "Участники: пользователи, готовые регулярно вести записи и выполнять задания.",
        conditions:
          "Условия: систематические записи, своевременная отправка заметок/материалов.",
        earnings:
          "Заработок: обычно £50–£500 за исследование.",
      },
      {
        id: 8,
        title: "8) Сообщества исследователей (Research Communities)",
        summary:
          "Закрытые сообщества брендов с регулярными мини-опросами и обсуждениями.",
        goals:
          "Цель: получать непрерывную обратную связь от лояльной аудитории.",
        participants:
          "Участники: приглашенные пользователи, соответствующие профилю бренда.",
        conditions:
          "Условия: периодическое участие в обсуждениях и коротких опросах.",
        earnings:
          "Заработок: деньги или баллы/бонусы в зависимости от программы.",
      },
      {
        id: 9,
        title: "9) Academic Research (университетские исследования)",
        summary:
          "Исследования университетов, бизнес-школ и лабораторий (в т.ч. поведенческие и психологические).",
        goals:
          "Цель: научные данные для статей, диссертаций и прикладных исследований.",
        participants:
          "Участники: студенты и широкая аудитория, подходящая под критерии конкретного проекта.",
        conditions:
          "Условия: выполнение исследовательских задач, соблюдение этических правил и инструкций.",
        earnings:
          "Заработок: часто £6–£20 в час; для части проектов возможны партнерские выплаты.",
      },
      {
        id: 10,
        title: "10) Экспертные интервью",
        summary:
          "Премиальный сегмент: компании и инвестфонды оплачивают консультации экспертов.",
        goals:
          "Цель: получить практическую отраслевую экспертизу для принятия решений.",
        participants:
          "Участники: опытные профессионалы с подтверждаемой экспертизой.",
        conditions:
          "Условия: предварительный отбор, профильное интервью/созвон, соблюдение правил конфиденциальности.",
        earnings:
          "Заработок: обычно £100–£1000+ за час в зависимости от уровня эксперта.",
      },
    ] as ResearchCard[],
  },

  EN: {
    pageTitle: "Research Bonuses",
    pageSubtitle:
      "Choose a research direction. Each card briefly describes goals, potential participants, participation conditions, and typical payouts.",
    cards: [
      {
        id: 1,
        title: "1) Paid Surveys",
        summary:
          "The most common format: questionnaires about purchases, habits, finance, cars, and other topics.",
        goals:
          "Goal: collect consumer opinions, validate hypotheses, and improve products/ads.",
        participants:
          "Participants: broad user audience, sometimes niche segments by age, region, or interests.",
        conditions:
          "Conditions: complete survey screening and provide honest, complete answers.",
        earnings:
          "Typical earnings: around £0.5–£20 per survey, often higher for niche audiences.",
      },
      {
        id: 2,
        title: "2) Focus Groups",
        summary:
          "Group discussions about products, interfaces, or advertising, often via Zoom.",
        goals:
          "Goal: gather deep qualitative feedback and understand user motivation.",
        participants:
          "Participants: target consumers and specialists (medical, IT, finance, etc.).",
        conditions:
          "Conditions: join timed sessions, actively discuss, and follow moderator instructions.",
        earnings:
          "Typical earnings: £30–£300 per session; up to £500–£1000 for rare expert profiles.",
      },
      {
        id: 3,
        title: "3) UX Research for Websites & Apps",
        summary:
          "Interface testing: registration, purchase flow, navigation, and usability comments.",
        goals:
          "Goal: identify UX/UI problems and improve conversion/usability.",
        participants:
          "Participants: regular users and targeted audiences with relevant experience.",
        conditions:
          "Conditions: complete task scenarios; sometimes screen and voice recording is required.",
        earnings:
          "Typical earnings: about £5–£100 per test.",
      },
      {
        id: 4,
        title: "4) Mystery Shopping (Online)",
        summary: "Service quality checks through real customer journeys.",
        goals:
          "Goal: evaluate support quality, response speed, and order flow.",
        participants:
          "Participants: users willing to complete a predefined interaction scenario.",
        conditions:
          "Conditions: place an order/contact support and submit a structured report.",
        earnings:
          "Typical earnings: fixed fee, often with expense reimbursement.",
      },
      {
        id: 5,
        title: "5) Medical Research",
        summary:
          "High-value studies involving patients, caregivers, and sometimes healthy volunteers.",
        goals:
          "Goal: collect insights on treatment, symptoms, and patient experience.",
        participants:
          "Participants: people with specific diagnoses, relatives/caregivers, and control groups.",
        conditions:
          "Conditions: strict screening, criteria verification, and protocol compliance.",
        earnings:
          "Typical earnings: £50–£2000+ depending on complexity and profile rarity.",
      },
      {
        id: 6,
        title: "6) B2B / Professional Research",
        summary:
          "Interviews and surveys with executives, accountants, developers, and business owners.",
        goals:
          "Goal: understand market decisions and professional pain points.",
        participants:
          "Participants: verified professionals and domain experts.",
        conditions:
          "Conditions: role/experience verification and topic-focused interviews.",
        earnings:
          "Typical earnings: £50–£500 per interview; one of the most profitable segments.",
      },
      {
        id: 7,
        title: "7) Diary Studies",
        summary:
          "Longitudinal studies where participants log actions over days or weeks.",
        goals:
          "Goal: observe real behavior over time instead of one-time survey snapshots.",
        participants:
          "Participants: users ready to report regularly and follow repeated tasks.",
        conditions: "Conditions: consistent entries and on-time submissions.",
        earnings: "Typical earnings: £50–£500 per study.",
      },
      {
        id: 8,
        title: "8) Research Communities",
        summary:
          "Invite-only brand communities with recurring discussions and mini-surveys.",
        goals:
          "Goal: maintain continuous feedback loops from loyal users.",
        participants:
          "Participants: invited users matching the brand profile.",
        conditions:
          "Conditions: periodic participation in discussions and short surveys.",
        earnings:
          "Typical earnings: cash or points/bonuses depending on the program.",
      },
      {
        id: 9,
        title: "9) Academic Research",
        summary:
          "University, business school, and lab studies, including behavioral and psychology projects.",
        goals:
          "Goal: generate scientific data for papers, theses, and applied research.",
        participants:
          "Participants: students and general audiences matching project criteria.",
        conditions:
          "Conditions: complete study tasks and follow ethics/informed-consent rules.",
        earnings:
          "Typical earnings: often £6–£20 per hour; some projects include partner payouts.",
      },
      {
        id: 10,
        title: "10) Expert Interviews",
        summary:
          "Premium segment where companies/funds pay experts for professional insights.",
        goals:
          "Goal: obtain practical industry expertise for business or investment decisions.",
        participants:
          "Participants: experienced professionals with verifiable expertise.",
        conditions:
          "Conditions: pre-screening, expert call/interview, confidentiality compliance.",
        earnings:
          "Typical earnings: commonly £100–£1000+ per hour.",
      },
    ] as ResearchCard[],
  },
};

function getLocale(lang: string) {
  return lang.toUpperCase() === "RU" ? content.RU : content.EN;
}

export default function BonusResearch() {
  const { lang } = useLang();
  const t = getLocale(lang);

  return (
    <main
      style={{
        minHeight: "calc(100vh - 72px)",
        padding: "28px 20px 36px",
        background: "linear-gradient(to bottom, #f5e8d3, #e3d2b8)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        color: "#173a33",
      }}
    >
      <section style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 10px", fontSize: "34px", lineHeight: 1.2 }}>
          {t.pageTitle}
        </h1>

        <p style={{ margin: "0 0 24px", fontSize: "17px", lineHeight: 1.55 }}>
          {t.pageSubtitle}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
          }}
        >
          {t.cards.map((card) => (
            <article
              key={card.id}
              style={{
                background: "rgba(255,255,255,0.88)",
                borderRadius: "14px",
                padding: "16px",
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                border: "1px solid rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "20px",
                  lineHeight: 1.3,
                }}
              >
                {card.title}
              </h2>

              <p style={{ margin: "0 0 8px", fontSize: "15px", lineHeight: 1.5 }}>
                {card.summary}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "15px", lineHeight: 1.5 }}>
                {card.goals}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "15px", lineHeight: 1.5 }}>
                {card.participants}
              </p>
              <p style={{ margin: "0 0 8px", fontSize: "15px", lineHeight: 1.5 }}>
                {card.conditions}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "15px",
                  lineHeight: 1.5,
                  fontWeight: 700,
                  color: "#0f4f42",
                }}
              >
                {card.earnings}
              </p>

              <Link
                to={`/bonuses/research/${directionPaths[card.id]}`}
                aria-label={`Apply / Start: ${card.title}`}
                style={{
                  display: "inline-block",
                  marginTop: "18px",
                  padding: "12px 20px",
                  background: "#0078ff",
                  color: "#fff",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                Apply / Start
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}