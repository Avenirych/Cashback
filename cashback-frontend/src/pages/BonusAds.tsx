import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { useOnboarding } from "../onboarding";
import "./BonusAds.css";
import content from "../content/advertisingPrograms.json";
import {BACKEND_URL} from '../backend';
import {activityText} from '../components/ActivityLimits';

const ASSET_BASE = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const BACKGROUND_URL = `${ASSET_BASE}/ads/background.png`;
const COIN_URL = `${ASSET_BASE}/ads/Coin.png`;
const DURATION_MS = 5000;

type Reward = 1 | 2 | 3;

interface DailyTotal {
  date: string;
  total: number;
}

interface AdsViewerProps {
  userId: number | null;
  token?:string|null;
  authLoading: boolean;
  requireAccess: () => boolean;
}

const messages = {
  RU: {
    unit: "бонусов",
    finish: "Завершить сессию",
    watching: "Просмотр рекламы",
    seconds: "сек.",
    loading: "Загрузка изображений…",
    waiting: "Подождите…",
    imageError:
      "Не удалось загрузить демонстрацию. Обновите страницу и попробуйте снова.",
    storageError:
      "Дневной результат не удалось сохранить. Он доступен только до ухода со страницы.",
    brandLine: "More video, more rewards",
  },
  EN: {
    unit: "bonuses",
    finish: "End session",
    watching: "Watching advertising",
    seconds: "sec.",
    loading: "Loading images…",
    waiting: "Please wait…",
    imageError:
      "Could not load the demonstration. Refresh the page and try again.",
    storageError:
      "Could not save today's total. It is available only until you leave this page.",
    brandLine: "More video, more rewards",
  },
  DE: {
    unit: "Boni",
    finish: "Sitzung beenden",
    watching: "Werbung wird angezeigt",
    seconds: "Sek.",
    loading: "Bilder werden geladen…",
    waiting: "Bitte warten…",
    imageError:
      "Hintergrund oder Münze konnte nicht geladen werden. Prüfen Sie die Bildpfade.",
    storageError:
      "Der Tageswert konnte nicht gespeichert werden. Er bleibt nur bis zum Verlassen der Seite verfügbar.",
    brandLine: "More video, more rewards",
  },
  FR: {
    unit: "bonus",
    finish: "Terminer la session",
    watching: "Publicité en cours",
    seconds: "s",
    loading: "Chargement des images…",
    waiting: "Veuillez patienter…",
    imageError:
      "Impossible de charger le fond ou la pièce. Vérifiez les chemins des images.",
    storageError:
      "Impossible d’enregistrer le total du jour. Il reste disponible uniquement jusqu’à votre départ de cette page.",
    brandLine: "More video, more rewards",
  },
};

function getMessages(lang: string) {
  switch (lang.toUpperCase()) {
    case "RU":
      return messages.RU;
    case "DE":
      return messages.DE;
    case "FR":
      return messages.FR;
    default:
      return messages.EN;
  }
}

function localDay(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function dailyKey(userId: number): string {
  return `cashback_demo_ads_daily:${userId}`;
}

function readDaily(
  userId: number,
  date: string
): DailyTotal | null {
  try {
    const raw = localStorage.getItem(dailyKey(userId));

    if (!raw) {
      return { date, total: 0 };
    }

    const saved = JSON.parse(raw);

    if (
      typeof saved?.date !== "string" ||
      !Number.isSafeInteger(saved?.total) ||
      saved.total < 0
    ) {
      return null;
    }

    return {
      date,
      total: saved.date === date ? saved.total : 0,
    };
  } catch {
    return null;
  }
}

function writeDaily(
  userId: number,
  value: DailyTotal
): boolean {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(dailyKey(userId), serialized);

    return localStorage.getItem(dailyKey(userId)) === serialized;
  } catch {
    return false;
  }
}

function pickReward(previous?: Reward): Reward {
  const options: Reward[] = [1, 2, 3];
  const available = options.filter(
    (value) => value !== previous
  );

  return available[
    Math.floor(Math.random() * available.length)
  ];
}

export default function BonusAds() {
  const navigate = useNavigate();
  const { user, token, loading } = useAuth();
  const { eligible } = useOnboarding();

  const hasAccess = Boolean(
    user &&
      token &&
      user.email_verified &&
      eligible
  );

  const requireAccess = (): boolean => {
    if (loading) return false;

    const next = "/bonuses/ads";

    if (!user || !token || !user.email_verified) {
      navigate(
        `/register?next=${encodeURIComponent(next)}`
      );
      return false;
    }

    if (!eligible) {
      navigate("/profile", {
        state: {
          bonusOnboardingRequired: true,
          next,
        },
      });
      return false;
    }

    return true;
  };

  // Перемонтируем плеер при смене аккаунта или прав.
  // Старая сессия не продолжится после выхода.
  const viewerKey = loading
    ? "loading"
    : `${user?.id ?? "guest"}:${hasAccess ? "allowed" : "blocked"}`;

  return (
    <AdsViewer
      key={viewerKey}
      userId={hasAccess && user ? user.id : null}
      token={token}
      authLoading={loading}
      requireAccess={requireAccess}
    />
  );
}

function AdsViewer({
  userId,
  token,
  authLoading,
  requireAccess,
}: AdsViewerProps) {
  const { lang } = useLang();
  const copy = content[lang.toLowerCase() as keyof typeof content] || content.en;
  const t = { ...getMessages(lang), consent: copy.consent, session: copy.session, daily: copy.daily };

  const [reward, setReward] = useState<Reward>(
    () => pickReward()
  );
  const [playing, setPlaying] = useState(false);
  const [settling,setSettling]=useState(false),[quotaError,setQuotaError]=useState(false);
  const operationKey=useRef(''),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const [remaining, setRemaining] = useState(5);
  const [sessionTotal, setSessionTotal] = useState(0);

  const [visible, setVisible] = useState(
    () => document.visibilityState === "visible"
  );

  const [assets, setAssets] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [storageError, setStorageError] = useState(false);

  const [daily, setDaily] = useState<DailyTotal>(() => {
    const date = localDay();

    if (userId === null) {
      return { date, total: 0 };
    }

    return readDaily(userId, date) ?? { date, total: 0 };
  });

  const dailyRef = useRef(daily);
  const elapsedRef = useRef(0);
  const creditedRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let failed = false;
    let loaded = 0;

    const images = [
      BACKGROUND_URL,
      COIN_URL,
    ].map(() => new Image());

    const timeout = window.setTimeout(() => {
      if (!disposed) {
        failed = true;
        setAssets("error");
      }
    }, 15000);

    [BACKGROUND_URL, COIN_URL].forEach((src, index) => {
      const image = images[index];

      image.onload = () => {
        if (disposed || failed) return;

        loaded += 1;

        if (loaded === images.length) {
          window.clearTimeout(timeout);
          setAssets("ready");
        }
      };

      image.onerror = () => {
        if (disposed) return;

        failed = true;
        window.clearTimeout(timeout);
        setAssets("error");
      };

      image.src = src;
    });

    return () => {
      disposed = true;
      window.clearTimeout(timeout);

      images.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      setVisible(
        document.visibilityState === "visible"
      );
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, []);

  useEffect(() => {
    // Гости не читают и не записывают дневной результат.
    if (userId === null) return;

    if (readDaily(userId, localDay()) === null) {
      setStorageError(true);
    }

    const checkDay = () => {
      const date = localDay();

      if (dailyRef.current.date === date) return;

      const next =
        readDaily(userId, date) ?? { date, total: 0 };

      dailyRef.current = next;
      setDaily(next);
    };

    const timer = window.setInterval(checkDay, 1000);

    return () => window.clearInterval(timer);
  }, [userId]);

  useEffect(() => {
    if (!playing || !visible || userId === null) return;

    let frameId = 0;
    let previousTime = performance.now();

    const tick = (now: number) => {
      if (document.visibilityState !== "visible") return;

      elapsedRef.current += now - previousTime;
      previousTime = now;

      setRemaining(
        Math.max(
          0,
          Math.ceil(
            (DURATION_MS - elapsedRef.current) / 1000
          )
        )
      );

      if (elapsedRef.current >= DURATION_MS) {
        if (!creditedRef.current) {
          creditedRef.current = true;
          const credit=()=>{
          const date = localDay();
          const stored = readDaily(userId, date);
          const memory = dailyRef.current;

          const base = Math.max(
            stored?.total ?? 0,
            memory.date === date ? memory.total : 0
          );

          const next = {
            date,
            total: base + reward,
          };

          dailyRef.current = next;
          setDaily(next);
          setStorageError(!writeDaily(userId, next));
          setSessionTotal((total) => total + reward);
          };
          if(process.env.REACT_APP_ACTIVITY_LIMITS==='true'){
            setSettling(true);setQuotaError(false);
            void fetch(BACKEND_URL+'/activity/demo/video',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':operationKey.current},body:'{}'})
              .then(r=>{if(!r.ok)throw Error();if(mounted.current)credit();})
              .catch(()=>{if(mounted.current)setQuotaError(true);})
              .finally(()=>{if(mounted.current)setSettling(false);});
          }else credit();
        }

        setPlaying(false);
        setReward(pickReward(reward));
        setRemaining(5);
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [playing, visible, reward, userId,token]);

  const startViewing = () => {
    if (playing || authLoading || settling) return;

    // Регистрация запускается именно по кнопке согласия.
    if (!requireAccess()) return;

    if (userId === null || assets !== "ready") return;
    if(process.env.REACT_APP_ACTIVITY_LIMITS==='true'){operationKey.current=crypto.randomUUID();setQuotaError(false);}

    elapsedRef.current = 0;
    creditedRef.current = false;
    setRemaining(5);
    setPlaying(true);
  };

  const endSession = () => {
    // Прерванный ролик не учитывается.
    setPlaying(false);
    elapsedRef.current = 0;
    creditedRef.current = false;
    setRemaining(5);
    setSessionTotal(0);
    setReward(pickReward(reward));
  };

  return (
    <main className="ads-page" lang={lang.toLowerCase()}>
      <div className="ads-content">
        <header className="ads-introduction">
          <h1>{copy.title}</h1><p>{copy.subtitle}</p><p>{copy.voluntary}</p>
          <strong className="ads-demo-badge">{copy.demoTitle}</strong>
        </header>
        <section
          className={`ads-screen ${
            playing ? "is-playing" : ""
          } ${!visible ? "is-paused" : ""}`}
          aria-label={t.watching}
        >
          <img
            className="ads-background"
            src={BACKGROUND_URL}
            alt=""
          />

          {playing ? (
            <>
              <div
                className="ads-coins"
                aria-hidden="true"
              >
                {Array.from(
                  { length: reward },
                  (_, index) => (
                    <div
                      className="ads-coin-arrival"
                      key={index}
                    >
                      <div className="ads-coin-glow" />

                      <div className="ads-coin-rotor">
                        <div className="ads-coin-edge" />

                        <div className="ads-coin-face ads-coin-front">
                          <img src={COIN_URL} alt="" />
                          <div className="ads-coin-shine" />
                        </div>

                        <div className="ads-coin-face ads-coin-back">
                          <img src={COIN_URL} alt="" />
                          <div className="ads-coin-shine" />
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="ads-caption">
                <strong>Cashback+</strong>
                <span>{t.brandLine}</span>
              </div>

              <div className="ads-time">
                {remaining} {t.seconds}
              </div>
            </>
          ) : (
            <div className="ads-consent">
              {assets === "loading" && (
                <p role="status">{t.loading}</p>
              )}

              {assets === "error" && (
                <p
                  className="ads-error"
                  role="alert"
                >
                  {t.imageError}
                </p>
              )}

              <div className="ads-consent-box">
                <button
                  className="ads-agree"
                  type="button"
                  onClick={startViewing}
                  disabled={
                    authLoading || settling ||
                    (userId !== null && assets !== "ready")
                  }
                >
                  {authLoading ? t.waiting : t.consent}
                </button>

                <p className="ads-cost">
                  <span>{copy.example} </span>{copy.maximum}
                </p>
              </div>
            </div>
          )}
        </section>

        <section
          className="ads-calculator"
          aria-label={t.session}
        >
          <div className="ads-counter">
            <span>{t.session}</span>
            <strong>{sessionTotal}</strong>
            <small>{t.unit}</small>
          </div>

          <div className="ads-counter">
            <span>{t.daily}</span>
            <strong>{daily.total}</strong>
            <small>{t.unit}</small>
          </div>

          <button
            className="ads-end-session"
            type="button"
            onClick={endSession}
          >
            {t.finish}
          </button>
        </section>

        <p className="ads-demo-note">{copy.counterNote}</p>
        <section className="ads-information" aria-labelledby="ads-demo-title">
          <h2 id="ads-demo-title">{copy.demoTitle}</h2>
          {copy.demoParagraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        </section>
        <section className="ads-information" aria-labelledby="ads-important-title">
          <h2 id="ads-important-title">{copy.importantTitle}</h2>
          {copy.importantParagraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
          <p>{copy.termsBefore}<Link to="/activity-limits">{copy.activityLink}</Link>{copy.termsBetween}<Link to="/terms">{copy.termsLink}</Link>{copy.termsAfter}</p>
        </section>
        {quotaError&&<p role="alert">{activityText(lang).error} <a href="/profile">{activityText(lang).title}</a></p>}

        {storageError && (
          <p
            className="ads-storage-warning"
            role="status"
          >
            {t.storageError}
          </p>
        )}
      </div>
    </main>
  );
}
