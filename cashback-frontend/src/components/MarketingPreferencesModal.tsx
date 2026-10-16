import React, { useState, useEffect, useRef } from "react";
import { translations } from "../i18n";
import type {
  MarketingPreferencesData,
  MarketingPreferencesFormData,
} from "../types/MarketingPreferences";

interface MarketingPreferencesModalProps {
  lang: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (preferences: MarketingPreferencesFormData) => Promise<void>;
  initialData?: MarketingPreferencesData;
  hasPhone?: boolean;
}

export default function MarketingPreferencesModal({
  lang,
  isOpen,
  onClose,
  onSave,
  initialData,
  hasPhone = false,
}: MarketingPreferencesModalProps) {
  const normalizedLang = (lang || "EN").toUpperCase();
  const languageKey = normalizedLang as keyof typeof translations;
  const t = translations[languageKey] ?? translations.EN;

  const [specialOffers, setSpecialOffers] = useState(false);
  const [partnerRecommendations, setPartnerRecommendations] = useState(false);
  const [smsMarketing, setSmsMarketing] = useState(false);
  const alive = useRef(true);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (closeTimer.current !== null) clearTimeout(closeTimer.current); };
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (initialData) {
      setSpecialOffers(initialData.specialOffers);
      setPartnerRecommendations(initialData.partnerRecommendations);
      setSmsMarketing(initialData.smsMarketing === true);
    } else {
      setSpecialOffers(false);
      setPartnerRecommendations(false);
      setSmsMarketing(false);
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      await onSave({
        specialOffers,
        partnerRecommendations,
        // Do not replay a cached consent when saving unrelated preferences.
        ...(smsMarketing !== (initialData?.smsMarketing === true) ? {smsMarketing} : {}),
      });
      if (!alive.current) return;
      setMessage({
        type: "success",
        text: t.preferencesSaved as string,
      });
      closeTimer.current = setTimeout(() => {
        onClose();
        setMessage(null);
      }, 2000);
    } catch (error) {
      if (!alive.current) return;
      setMessage({
        type: "error",
        text: t.preferencesError as string,
      });
    } finally {
      if (alive.current) setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "32px",
          maxWidth: "600px",
          width: "calc(100% - 40px)",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 12px 48px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 700,
            marginBottom: "12px",
          }}
        >
          {t.marketingPreferencesTitle}
        </h2>

        <p
          style={{
            color: "#666",
            marginBottom: "24px",
            lineHeight: 1.6,
          }}
        >
          {t.marketingPreferencesDescription}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Account Updates - Mandatory */}
            <div
              style={{
                padding: "16px",
                background: "#f5f5f5",
                borderRadius: "8px",
                border: "1px solid #e0e0e0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      margin: "0 0 4px 0",
                    }}
                  >
                    {t.accountUpdates}
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      margin: 0,
                    }}
                  >
                    {t.accountUpdatesDesc}
                  </p>
                </div>
                <span
                  style={{
                    background: "#2196F3",
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    marginLeft: "12px",
                  }}
                >
                  {t.mandatory}
                </span>
              </div>
              <div style={{ color: "#0c5aa0", fontSize: "13px" }}>
                ✓ {t.enabled}
              </div>
            </div>

            {/* Special Offers - Optional */}
            <div
              style={{
                padding: "16px",
                background: specialOffers ? "#f0f8ff" : "#fafafa",
                borderRadius: "8px",
                border: `2px ${specialOffers ? "solid #2196F3" : "solid #e0e0e0"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      margin: "0 0 4px 0",
                    }}
                  >
                    {t.specialOffers}
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      margin: 0,
                    }}
                  >
                    {t.specialOffersDesc}
                  </p>
                </div>
                <span
                  style={{
                    background: "#FF9800",
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    marginLeft: "12px",
                  }}
                >
                  {t.optional}
                </span>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={specialOffers}
                  onChange={(e) => setSpecialOffers(e.target.checked)}
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                  }}
                />
                <span style={{ fontSize: "14px" }}>
                  {specialOffers ? t.enabled : t.disabled}
                </span>
              </label>
            </div>

            {/* Partner Recommendations - Optional */}
            <div
              style={{
                padding: "16px",
                background: partnerRecommendations ? "#f0f8ff" : "#fafafa",
                borderRadius: "8px",
                border: `2px ${
                  partnerRecommendations
                    ? "solid #2196F3"
                    : "solid #e0e0e0"
                }`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      margin: "0 0 4px 0",
                    }}
                  >
                    {t.partnerRecommendations}
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      color: "#666",
                      margin: 0,
                    }}
                  >
                    {t.partnerRecommendationsDesc}
                  </p>
                </div>
                <span
                  style={{
                    background: "#FF9800",
                    color: "white",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    marginLeft: "12px",
                  }}
                >
                  {t.optional}
                </span>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={partnerRecommendations}
                  onChange={(e) =>
                    setPartnerRecommendations(e.target.checked)
                  }
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: "pointer",
                  }}
                />
                <span style={{ fontSize: "14px" }}>
                  {partnerRecommendations ? t.enabled : t.disabled}
                </span>
              </label>
            </div>

            <div>
              <label>
                <input type="checkbox" checked={smsMarketing}
                  disabled={isLoading || (!hasPhone && !smsMarketing)}
                  onChange={event => setSmsMarketing(event.target.checked)} />
                {t.smsMarketing}
              </label>
              {!hasPhone && <p>{t.smsPhoneRequired}</p>}
            </div>

            {/* Info Box */}
            <div
              style={{
                padding: "12px",
                background: "#e8f4f8",
                borderLeft: "4px solid #0288d1",
                borderRadius: "4px",
                fontSize: "13px",
                color: "#01579b",
                lineHeight: 1.5,
              }}
            >
              ℹ️ {t.unsubscribeInfo}
            </div>

            {/* Message */}
            {message && (
              <div
                style={{
                  padding: "12px",
                  background: message.type === "success" ? "#c8e6c9" : "#ffcdd2",
                  color: message.type === "success" ? "#2e7d32" : "#c62828",
                  borderRadius: "4px",
                  fontSize: "14px",
                  textAlign: "center",
                }}
              >
                {message.text}
              </div>
            )}

            {/* Buttons */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                style={{
                  padding: "12px 24px",
                  background: "#f0f0f0",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {t.cancel}
              </button>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: "12px 24px",
                  background: "#2196F3",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                {isLoading ? t.creating : t.savePreferences}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
