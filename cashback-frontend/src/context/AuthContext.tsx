import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { ForumUserData, validateForumAvatar } from "../forum";
import { useLang } from "./LanguageContext";

export type { ForumUserData } from "../forum";

const API_URL = "http://localhost:3001";
const TOKEN_KEY = "cashback_token";
const PENDING_AUTH_KEY = "cashback_pending_auth";
const PENDING_VERIFICATION_KEY = "cashback_pending_verification";

interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
  balance?: number;
  email_verified?: boolean;
}

export interface RegisterResult {
  message?: string;
  verification_email_sent?: boolean;
  preview_url?: string | null;
}

export interface ResendResult {
  message?: string;
  preview_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isEmailVerificationPending: boolean;
  login: (data: {
    email: string;
    password: string;
  }) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
  }) => Promise<RegisterResult>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<ResendResult>;
  logout: () => void;
  forumUser: ForumUserData | null;
  forumSessionActive: boolean;
  forumLoading: boolean;
  forumRegistered: boolean;
  forumBanned: boolean;
  registerForum: (
    username: string,
    agreedToRules: boolean,
    avatarFile?: File
  ) => Promise<void>;
  logoutFromForum: () => void;
  checkForumStatus: (reenter?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function storageGet(
  storage: "local" | "session",
  key: string
): string | null {
  try {
    return storage === "local"
      ? localStorage.getItem(key)
      : sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(
  storage: "local" | "session",
  key: string,
  value: string
) {
  try {
    if (storage === "local") {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // При недоступном хранилище текущая сессия остаётся в памяти.
  }
}

function storageRemove(
  storage: "local" | "session",
  key: string
) {
  try {
    if (storage === "local") {
      localStorage.removeItem(key);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // Хранилище может быть заблокировано браузером.
  }
}

function clearPendingVerification() {
  storageRemove("session", PENDING_AUTH_KEY);
  storageRemove("session", PENDING_VERIFICATION_KEY);
}

const exitKey = (id: number) => `cashback_forum_exited:${id}`;

const exited = (id: number) =>
  storageGet("session", exitKey(id)) === "1";

const markExited = (id: number, value: boolean) => {
  if (value) {
    storageSet("session", exitKey(id), "1");
  } else {
    storageRemove("session", exitKey(id));
  }
};

function parseError(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.message;

    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;

    return fallback;
  } catch {
    return text || fallback;
  }
}

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { lang } = useLang();
  const language = useRef(lang);
  language.current = lang.toLowerCase();

  const forumMessage = useCallback(
    (en: string, ru: string) =>
      language.current === "ru" ? ru : en,
    []
  );

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [
    isEmailVerificationPending,
    setIsEmailVerificationPending,
  ] = useState(false);

  const [forumUser, setForumUser] =
    useState<ForumUserData | null>(null);
  const [forumSessionActive, setForumSessionActive] =
    useState(false);
  const [forumLoading, setForumLoading] = useState(true);
  const [forumRegistered, setForumRegistered] =
    useState(false);
  const [forumBanned, setForumBanned] = useState(false);

  const forumExited = useRef(false);
  const session = useRef<{
    token: string | null;
    user: User | null;
  }>({ token: null, user: null });
  const forumProfile = useRef<ForumUserData | null>(null);
  const authRevision = useRef(0);
  const forumRevision = useRef(0);

  const resetForum = () => {
    forumRevision.current++;
    forumProfile.current = null;
    forumExited.current = false;
    setForumRegistered(false);
    setForumBanned(false);
    setForumUser(null);
    setForumSessionActive(false);
    setForumLoading(false);
  };

  const checkForumStatus = useCallback(
    async (reenter = false) => {
      const current = session.current;
      if (!current.token || !current.user?.email_verified) {
        return;
      }

      const revision = ++forumRevision.current;
      setForumLoading(true);

      try {
        const response = await fetch(`${API_URL}/forum/status`, {
          headers: {
            Authorization: `Bearer ${current.token}`,
          },
        });

        if (!response.ok) {
          throw new Error(
            forumMessage(
              "Could not check forum membership",
              "Не удалось проверить аккаунт форума"
            )
          );
        }

        const result = await response.json();

        if (
          revision !== forumRevision.current ||
          session.current !== current
        ) {
          return;
        }

        const profile: ForumUserData | null =
          result.registered ? result.forumUser : null;

        forumProfile.current = profile;
        setForumRegistered(!!profile);
        setForumBanned(!!profile?.banned);

        if (reenter && profile) {
          forumExited.current = false;
          markExited(current.user.id, false);
        }

        const active =
          !!profile &&
          (reenter ||
            (!forumExited.current && !exited(current.user.id)));

        setForumUser(active ? profile : null);
        setForumSessionActive(active);
      } catch (error) {
        if (
          revision !== forumRevision.current ||
          session.current !== current
        ) {
          return;
        }

        setForumSessionActive(false);

        if (error instanceof TypeError) {
          throw new Error(
            forumMessage(
              "Could not connect to the forum. Please retry.",
              "Не удалось подключиться к форуму. Попробуйте ещё раз."
            )
          );
        }

        throw error;
      } finally {
        if (
          revision === forumRevision.current &&
          session.current === current
        ) {
          setForumLoading(false);
        }
      }
    },
    [forumMessage]
  );

  useEffect(() => {
    if (user?.email_verified && token) {
      void checkForumStatus().catch(() => {});
    } else {
      setForumLoading(false);
    }
  }, [user, token, checkForumStatus]);

  const logoutFromForum = useCallback(() => {
    forumRevision.current++;
    forumExited.current = true;

    if (session.current.user) {
      markExited(session.current.user.id, true);
    }

    setForumSessionActive(false);
    setForumUser(null);
    setForumLoading(false);
  }, []);

  const registerForum = useCallback(
    async (
      username: string,
      agreedToRules: boolean,
      avatarFile?: File
    ) => {
      const current = session.current;

      if (!current.token || !current.user?.email_verified) {
        throw new Error(
          forumMessage(
            "Verify your email first",
            "Сначала подтвердите email"
          )
        );
      }

      if (
        (!forumProfile.current &&
          !/^[A-Za-z0-9_]{3,30}$/.test(username)) ||
        !agreedToRules
      ) {
        throw new Error(
          forumMessage(
            "Valid username and rules agreement required",
            "Укажите допустимое имя пользователя и примите правила"
          )
        );
      }

      if (!validateForumAvatar(avatarFile)) {
        throw new Error(
          forumMessage(
            "Avatar must be JPG, PNG or WebP, maximum 500 KB",
            "Аватар должен быть JPG, PNG или WebP, максимум 500 КБ"
          )
        );
      }

      const revision = ++forumRevision.current;

      const assertCurrent = () => {
        if (
          session.current !== current ||
          forumRevision.current !== revision
        ) {
          throw new Error(
            forumMessage(
              "Forum session changed; please try again",
              "Сессия форума изменилась. Попробуйте ещё раз"
            )
          );
        }
      };

      setForumLoading(true);

      try {
        let profile = forumProfile.current;

        if (!profile) {
          const response = await fetch(
            `${API_URL}/forum/register`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${current.token}`,
              },
              body: JSON.stringify({ username, agreedToRules }),
            }
          );

          if (!response.ok) {
            throw new Error(
              parseError(
                await response.text(),
                forumMessage(
                  "Forum registration failed",
                  "Не удалось зарегистрироваться на форуме"
                )
              )
            );
          }

          profile = (await response.json()) as ForumUserData;
          assertCurrent();

          // Сохраняем регистрацию даже при ошибке загрузки аватара.
          forumProfile.current = profile;
          setForumRegistered(true);
          setForumBanned(profile.banned);
          setForumUser(profile);
        }

        if (profile.banned) {
          throw new Error(
            forumMessage(
              "Your forum account is banned",
              "Ваш аккаунт форума заблокирован"
            )
          );
        }

        if (avatarFile) {
          const body = new FormData();
          body.append("file", avatarFile);

          const response = await fetch(`${API_URL}/forum/avatar`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${current.token}`,
            },
            body,
          });

          if (!response.ok) {
            throw new Error(
              parseError(
                await response.text(),
                forumMessage(
                  "Account registered, but avatar upload failed. Retry or enter without an avatar.",
                  "Аккаунт зарегистрирован, но аватар не загрузился. Повторите попытку или войдите без аватара."
                )
              )
            );
          }

          profile = (await response.json()) as ForumUserData;
          assertCurrent();

          forumProfile.current = profile;
          setForumUser(profile);
          setForumBanned(profile.banned);
        }

        assertCurrent();
        markExited(current.user.id, false);
        forumExited.current = false;
        setForumUser(profile);
        setForumSessionActive(true);
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(
            forumMessage(
              "Could not connect to the forum. Please retry.",
              "Не удалось подключиться к форуму. Попробуйте ещё раз."
            )
          );
        }

        throw error;
      } finally {
        if (
          session.current === current &&
          revision === forumRevision.current
        ) {
          setForumLoading(false);
        }
      }
    },
    [forumMessage]
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const revision = authRevision.current;
      const persistentToken = storageGet("local", TOKEN_KEY);
      const pendingToken = storageGet("session", PENDING_AUTH_KEY);
      const savedToken = persistentToken || pendingToken;

      const isCurrent = () =>
        !cancelled && revision === authRevision.current;

      if (!savedToken) {
        if (isCurrent()) setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (!isCurrent()) return;

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            storageRemove("local", TOKEN_KEY);
            storageRemove("session", PENDING_AUTH_KEY);
            // Адрес для повторной отправки письма сохраняем.
          }

          throw new Error("Could not restore session");
        }

        const userData = (await response.json()) as User;
        if (!isCurrent()) return;

        // Статус подтверждения берём с сервера, не из хранилища.
        const verified = userData.email_verified === true;

        if (verified) {
          storageSet("local", TOKEN_KEY, savedToken);
          clearPendingVerification();
        } else {
          storageRemove("local", TOKEN_KEY);
          storageSet("session", PENDING_AUTH_KEY, savedToken);

          const pendingInfo = storageGet(
            "session",
            PENDING_VERIFICATION_KEY
          );

          if (!pendingInfo) {
            storageSet(
              "session",
              PENDING_VERIFICATION_KEY,
              JSON.stringify({ email: userData.email })
            );
          }
        }

        session.current = {
          token: savedToken,
          user: userData,
        };
        setUser(userData);
        setToken(savedToken);
        setIsEmailVerificationPending(!verified);
        setForumLoading(verified);
      } catch (error) {
        if (!isCurrent()) return;

        console.error("Failed to restore session:", error);
        session.current = { token: null, user: null };
        setUser(null);
        setToken(null);
        setIsEmailVerificationPending(false);
        setForumLoading(false);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    };

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const applySessionTemporary = (
    newToken: string,
    newUser: User
  ) => {
    authRevision.current++;
    resetForum();
    session.current = { token: newToken, user: newUser };

    storageRemove("local", TOKEN_KEY);
    storageSet("session", PENDING_AUTH_KEY, newToken);
    storageSet(
      "session",
      PENDING_VERIFICATION_KEY,
      JSON.stringify({ email: newUser.email })
    );

    setToken(newToken);
    setUser(newUser);
    setIsEmailVerificationPending(!newUser.email_verified);
    setLoading(false);
  };

  const applySessionPersistent = (
    newToken: string,
    newUser: User
  ) => {
    if (!newUser.email_verified) {
      applySessionTemporary(newToken, newUser);
      return;
    }

    authRevision.current++;
    resetForum();
    session.current = { token: newToken, user: newUser };

    storageSet("local", TOKEN_KEY, newToken);
    clearPendingVerification();

    setToken(newToken);
    setUser(newUser);
    setIsEmailVerificationPending(false);
    setForumLoading(true);
    setLoading(false);
  };

  const login = async (data: {
    email: string;
    password: string;
  }) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(parseError(text, "Login failed"));
    }

    const result = JSON.parse(text);
    applySessionPersistent(result.access_token, result.user);
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
  }): Promise<RegisterResult> => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(parseError(text, "Registration failed"));
    }

    const result = JSON.parse(text);
    applySessionPersistent(result.access_token, result.user);

    if (!result.user.email_verified) {
      storageSet(
        "session",
        PENDING_VERIFICATION_KEY,
        JSON.stringify({
          email: result.user.email,
          verification_email_sent: result.verification_email_sent,
          preview_url: result.preview_url ?? null,
        })
      );
    }

    return {
      message: result.message,
      verification_email_sent: result.verification_email_sent,
      preview_url: result.preview_url,
    };
  };

  const verifyEmail = async (verificationToken: string) => {
    const response = await fetch(
      `${API_URL}/auth/verify-email?token=${encodeURIComponent(
        verificationToken
      )}`
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        parseError(text, "Email verification failed")
      );
    }

    const result = JSON.parse(text);
    applySessionPersistent(result.access_token, result.user);
  };

  const resendVerification = async (
    email: string
  ): Promise<ResendResult> => {
    const response = await fetch(
      `${API_URL}/auth/resend-verification`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        parseError(text, "Could not resend email")
      );
    }

    return JSON.parse(text);
  };

  const logout = () => {
    authRevision.current++;
    session.current = { token: null, user: null };
    resetForum();

    storageRemove("local", TOKEN_KEY);
    clearPendingVerification();

    setToken(null);
    setUser(null);
    setIsEmailVerificationPending(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isEmailVerificationPending,
        login,
        register,
        verifyEmail,
        resendVerification,
        logout,
        forumUser,
        forumSessionActive,
        forumLoading,
        forumRegistered,
        forumBanned,
        registerForum,
        logoutFromForum,
        checkForumStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};