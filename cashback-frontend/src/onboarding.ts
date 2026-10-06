import { useEffect, useReducer } from "react";
import { useAuth } from "./context/AuthContext";

export interface WiseForm {
  fullName: string;
  email: string;
  currency: string;
  accountType: string;
  wiseEmail: string;
}

export const emptyWiseForm: WiseForm = {
  fullName: "", email: "", currency: "", accountType: "", wiseEmail: "",
};
export const wiseKey = "cashback_wise_data";
export const enrollmentKey = "cashback_program_enrolled";
const changeEvent = "cashback-onboarding-change";
const failedWrites = new Set<number>();

export function validUserId(userId: unknown): userId is number {
  return typeof userId === "number" && Number.isSafeInteger(userId) && userId > 0;
}

export function validateWiseForm(data: WiseForm) {
  const errors: Partial<Record<keyof WiseForm, "required" | "invalidEmail">> = {};
  (Object.keys(emptyWiseForm) as (keyof WiseForm)[]).forEach((field) => {
    if (typeof data[field] !== "string" || !data[field].trim()) errors[field] = "required";
  });
  (["email", "wiseEmail"] as const).forEach((field) => {
    if (typeof data[field] === "string" && data[field].trim() &&
      !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(data[field].trim())) {
      errors[field] = "invalidEmail";
    }
  });
  if (!["EUR", "GBP", "USD"].includes(data.currency)) errors.currency = "required";
  if (!["Personal", "Business"].includes(data.accountType)) errors.accountType = "required";
  return errors;
}

function readLocalData(key: string, userId: number) {
  const raw = localStorage.getItem(`${key}:${userId}`) ?? localStorage.getItem(key);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) && data.userId === userId
      ? data : null;
  } catch {
    return null;
  }
}

function validDate(date: unknown): date is string {
  return typeof date === "string" && date.trim() !== "" && Number.isFinite(Date.parse(date));
}

export function readOnboarding(userId: unknown) {
  const blocked = {
    form: { ...emptyWiseForm }, credentialsSaved: false,
    enrolledAt: null as string | null, eligible: false,
  };
  if (!validUserId(userId) || failedWrites.has(userId)) return blocked;
  try {
    const saved = readLocalData(wiseKey, userId);
    const enrollment = readLocalData(enrollmentKey, userId);
    const form = { ...emptyWiseForm };
    (Object.keys(form) as (keyof WiseForm)[]).forEach((field) => {
      if (typeof saved?.[field] === "string") form[field] = saved[field];
    });
    const credentialsSaved = Object.keys(validateWiseForm(form)).length === 0 &&
      validDate(saved?.savedAt);
    const enrolledAt = credentialsSaved && validDate(enrollment?.enrolledAt) &&
      Date.parse(enrollment.enrolledAt) >= Date.parse(saved.savedAt)
      ? enrollment.enrolledAt as string : null;
    return { form, credentialsSaved, enrolledAt, eligible: !!enrolledAt };
  } catch {
    return blocked;
  }
}

// Browser-only demo state, not server-side payout authorization.
function writeOnboarding(userId: number, changes: Record<string, string | null>) {
  const previous: Record<string, string | null> = {};
  try {
    Object.keys(changes).forEach((key) => { previous[key] = localStorage.getItem(key); });
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
    Object.entries(changes).forEach(([key, value]) => {
      if (localStorage.getItem(key) !== value) throw new Error("Storage verification failed");
    });
    failedWrites.delete(userId);
  } catch (error) {
    Object.entries(previous).forEach(([key, value]) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // A failed rollback must never enable access in this session.
        failedWrites.add(userId);
      }
    });
    throw error;
  } finally {
    window.dispatchEvent(new Event(changeEvent));
  }
}

export function saveCredentials(userId: unknown, form: WiseForm) {
  if (!validUserId(userId) || Object.keys(validateWiseForm(form)).length) {
    throw new Error("Invalid credentials or user");
  }
  const data = { ...form };
  (Object.keys(data) as (keyof WiseForm)[]).forEach((field) => {
    data[field] = data[field].trim();
  });
  const serialized = JSON.stringify({ ...data, userId, savedAt: new Date().toISOString() });
  const changes: Record<string, string | null> = {
    [`${wiseKey}:${userId}`]: serialized,
    [wiseKey]: serialized,
    [`${enrollmentKey}:${userId}`]: null,
  };
  // Repairing credentials requires fresh explicit enrollment, not an old status.
  try {
    if (JSON.parse(localStorage.getItem(enrollmentKey) || "null")?.userId === userId) {
      changes[enrollmentKey] = null;
    }
  } catch {
    // Corrupt unscoped records cannot grant access; do not touch other users.
  }
  writeOnboarding(userId, changes);
}

export function enrollInProgram(userId: unknown) {
  if (!validUserId(userId) || !readOnboarding(userId).credentialsSaved) {
    throw new Error("Saved credentials required");
  }
  const serialized = JSON.stringify({ userId, enrolledAt: new Date().toISOString() });
  writeOnboarding(userId, {
    [`${enrollmentKey}:${userId}`]: serialized,
    [enrollmentKey]: serialized,
  });
}

export function useOnboarding() {
  const { user, loading } = useAuth();
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === wiseKey || event.key === enrollmentKey ||
        event.key?.startsWith(`${wiseKey}:`) || event.key?.startsWith(`${enrollmentKey}:`)) {
        refresh();
      }
    };
    window.addEventListener(changeEvent, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(changeEvent, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return readOnboarding(loading ? null : user?.id);
}

const onboardingMessages = {
  en: {
    explanation: "To access bonuses, fill in the Wise form, save your credentials, then explicitly enroll in the program. Registration and accepting terms do not enroll you.",
    profile: "Complete onboarding in Profile",
  },
  ru: {
    explanation: "Для доступа к бонусам заполните форму Wise, сохраните реквизиты, затем явно присоединитесь к программе. Регистрация и согласие с условиями не означают участие в программе.",
    profile: "Заполнить форму в профиле",
  },
  de: {
    explanation: "Für den Zugang zu Boni füllen Sie das Wise-Formular aus, speichern Sie Ihre Kontodaten und nehmen Sie anschließend ausdrücklich am Programm teil. Registrierung und Zustimmung zu den Bedingungen bedeuten keine Teilnahme.",
    profile: "Formular im Profil ausfüllen",
  },
  fr: {
    explanation: "Pour accéder aux bonus, remplissez le formulaire Wise, enregistrez vos coordonnées, puis rejoignez explicitement le programme. L'inscription et l'acceptation des conditions ne vous y inscrivent pas.",
    profile: "Remplir le formulaire dans le profil",
  },
};

export function getOnboardingMessages(lang: string) {
  return onboardingMessages[lang.toLowerCase() as keyof typeof onboardingMessages] ||
    onboardingMessages.en;
}
