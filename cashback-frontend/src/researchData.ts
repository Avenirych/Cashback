export interface DirectionText {
  title: string;
  summary: string;
  goals: string;
  participants: string;
  conditions: string;
}

export interface ResearchDirection {
  id: string;
  ru: DirectionText;
  en: DirectionText;
}

export interface Study {
  id: number;
  directionId: string;
  expectedBonuses: number;
}

export const directions: ResearchDirection[] = [
  {
    id: "surveys",
    ru: {
      title: "Маркетинговые опросы",
      summary: "Анкеты о покупках, привычках и предпочтениях.",
      goals: "Изучить мнение покупателей и улучшить продукты и рекламу.",
      participants: "Потребители, соответствующие требованиям конкретного опроса.",
      conditions: "Пройти предварительный отбор и честно ответить на вопросы.",
    },
    en: {
      title: "Paid Surveys",
      summary: "Questionnaires about purchases, habits and preferences.",
      goals: "Understand customer opinions and improve products and advertising.",
      participants: "Consumers who meet the requirements of each survey.",
      conditions: "Complete screening and answer the questions honestly.",
    },
  },
  {
    id: "focus-groups",
    ru: {
      title: "Фокус-группы",
      summary: "Обсуждение продуктов и идей с модератором.",
      goals: "Получить подробную обратную связь и понять мотивацию участников.",
      participants: "Представители целевой аудитории или профильные специалисты.",
      conditions: "Подключиться в назначенное время и участвовать в обсуждении.",
    },
    en: {
      title: "Focus Groups",
      summary: "Moderated discussions about products and ideas.",
      goals: "Collect detailed feedback and understand participant motivations.",
      participants: "Target consumers or relevant professionals.",
      conditions: "Join at the scheduled time and contribute to the discussion.",
    },
  },
  {
    id: "ux",
    ru: {
      title: "UX-исследования",
      summary: "Проверка удобства сайтов и приложений.",
      goals: "Найти сложности в интерфейсе и улучшить пользовательский опыт.",
      participants: "Пользователи с подходящими устройствами и опытом.",
      conditions: "Выполнить задания; запись экрана и голоса — только с согласия.",
    },
    en: {
      title: "UX Research",
      summary: "Usability testing of websites and applications.",
      goals: "Identify interface problems and improve the user experience.",
      participants: "Users with suitable devices and relevant experience.",
      conditions: "Complete tasks; screen and voice recording require consent.",
    },
  },
  {
    id: "mystery-shopping",
    ru: {
      title: "Тайный покупатель",
      summary: "Оценка обслуживания по заданному сценарию.",
      goals: "Проверить работу поддержки и процесса оформления заказа.",
      participants: "Пользователи, готовые выполнить сценарий и составить отчёт.",
      conditions: "Заранее согласовать расходы и условия их компенсации.",
    },
    en: {
      title: "Mystery Shopping",
      summary: "Service evaluation using a predefined scenario.",
      goals: "Review customer support and the ordering process.",
      participants: "Users willing to follow a scenario and submit a report.",
      conditions: "Agree on any expenses and reimbursement terms in advance.",
    },
  },
  {
    id: "health",
    ru: {
      title: "Исследования опыта пациентов",
      summary: "Опросы и интервью о здоровье и опыте получения помощи.",
      goals: "Лучше понять потребности пациентов и ухаживающих за ними людей.",
      participants: "Пациенты, родственники и другие подходящие участники.",
      conditions:
        "Добровольное согласие и защита личных данных. Здесь не предлагаются клинические испытания.",
    },
    en: {
      title: "Patient Experience Research",
      summary: "Surveys and interviews about health and care experiences.",
      goals: "Understand the needs of patients and caregivers.",
      participants: "Patients, relatives and other eligible participants.",
      conditions:
        "Voluntary consent and personal data protection. No clinical trials are offered here.",
    },
  },
  {
    id: "b2b",
    ru: {
      title: "Исследования среди профессионалов",
      summary: "Интервью о работе, бизнесе и профессиональных инструментах.",
      goals: "Изучить процессы принятия решений и рабочие потребности.",
      participants: "Руководители, специалисты и владельцы бизнеса.",
      conditions: "Подтвердить опыт, не раскрывая конфиденциальные данные работодателя.",
    },
    en: {
      title: "B2B / Professional Research",
      summary: "Interviews about work, business and professional tools.",
      goals: "Understand decision-making processes and workplace needs.",
      participants: "Managers, professionals and business owners.",
      conditions: "Verify experience without disclosing employer confidential information.",
    },
  },
  {
    id: "diaries",
    ru: {
      title: "Онлайн-дневники",
      summary: "Регулярные записи о привычках и использовании продуктов.",
      goals: "Изучить поведение участников в течение нескольких дней или недель.",
      participants: "Пользователи, готовые регулярно выполнять задания.",
      conditions: "Вести записи по графику и отправлять материалы вовремя.",
    },
    en: {
      title: "Diary Studies",
      summary: "Regular entries about habits and product use.",
      goals: "Observe participant behavior over several days or weeks.",
      participants: "Users willing to complete recurring tasks.",
      conditions: "Keep scheduled entries and submit materials on time.",
    },
  },
  {
    id: "communities",
    ru: {
      title: "Исследовательские сообщества",
      summary: "Обсуждения и короткие опросы в закрытых группах.",
      goals: "Получать обратную связь о продуктах на регулярной основе.",
      participants: "Пользователи, соответствующие профилю сообщества.",
      conditions: "Соблюдать правила группы и участвовать в доступных заданиях.",
    },
    en: {
      title: "Research Communities",
      summary: "Discussions and short surveys in private groups.",
      goals: "Collect ongoing feedback about products.",
      participants: "Users matching the community profile.",
      conditions: "Follow community rules and take part in available tasks.",
    },
  },
  {
    id: "academic",
    ru: {
      title: "Университетские исследования",
      summary: "Научные опросы и поведенческие задания.",
      goals: "Собрать данные для научных проектов.",
      participants: "Студенты и другие участники, подходящие по критериям проекта.",
      conditions: "Ознакомиться с согласием на участие и следовать инструкциям.",
    },
    en: {
      title: "Academic Research",
      summary: "Scientific surveys and behavioral tasks.",
      goals: "Collect data for academic projects.",
      participants: "Students and other people meeting project criteria.",
      conditions: "Read the participation consent and follow the instructions.",
    },
  },
  {
    id: "experts",
    ru: {
      title: "Экспертные интервью",
      summary: "Обсуждение отраслевых вопросов с опытными специалистами.",
      goals: "Получить профессиональную оценку и практические знания.",
      participants: "Эксперты с подтверждаемым опытом.",
      conditions:
        "Пройти отбор и соблюдать ограничения по конфиденциальности и конфликтам интересов.",
    },
    en: {
      title: "Expert Interviews",
      summary: "Industry discussions with experienced professionals.",
      goals: "Obtain professional assessments and practical insights.",
      participants: "Experts with verifiable experience.",
      conditions:
        "Complete screening and observe confidentiality and conflict-of-interest restrictions.",
    },
  },
];

// Воспроизводимая псевдослучайная генерация.
// Изменение seed создаст другой демонстрационный набор.
function createRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createStudies(): Study[] {
  const random = createRandom(20261008);
  const ids = Array.from({ length: 100 }, (_, index) => index + 1);

  // Перемешивание номеров исследований.
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [ids[index], ids[target]] = [ids[target], ids[index]];
  }

  return ids.map((id, index) => ({
    id,
    directionId: directions[Math.floor(index / 10)].id,
    expectedBonuses: 5 + Math.floor(random() * 46),
  }));
}

export const studies = createStudies();

export function getDirectionText(
  direction: ResearchDirection,
  lang: string
): DirectionText {
  return lang.toUpperCase() === "RU" ? direction.ru : direction.en;
}

export function getResearchMessages(lang: string) {
  const ru = lang.toUpperCase() === "RU";

  return {
    title: ru ? "Исследования" : "Research",
    subtitle: ru
      ? "Выберите направление и откройте список исследований."
      : "Choose a category and browse its studies.",
    demo: ru
      ? "Демонстрационный каталог. Партнёры пока не подключены. Ожидаемые бонусы не гарантированы и не начисляются."
      : "Demo catalogue. Partners are not connected yet. Expected bonuses are not guaranteed and are not credited.",
    goals: ru ? "Цели" : "Goals",
    participants: ru ? "Участники" : "Participants",
    conditions: ru ? "Условия" : "Conditions",
    expected: ru ? "Ожидаемые бонусы" : "Expected bonuses",
    bonusRange: ru ? "5–50 бонусов за исследование" : "5–50 bonuses per study",
    studyCount: ru ? "Исследований" : "Studies",
    start: "Apply / Start",
    participate: ru ? "Участвовать" : "Participate",
    back: ru ? "Все направления" : "All categories",
    notFound: ru ? "Направление не найдено" : "Category not found",
    empty: ru ? "Нет исследований" : "No studies",
    studyName: (id: number) => ru ? `Исследование № ${id}` : `Study No. ${id}`,
  };
}