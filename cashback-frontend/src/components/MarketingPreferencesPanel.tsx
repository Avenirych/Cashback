import { BACKEND_URL, backendFetch } from "../backend";
import React, { useState, useEffect, useRef } from "react";
import MarketingPreferencesModal from "./MarketingPreferencesModal";
import { translations } from "../i18n";
import { useAuth } from "../context/AuthContext";
import type {
  MarketingPreferencesData,
  MarketingPreferencesFormData,
} from "../types/MarketingPreferences";

interface MarketingPreferencesPanelProps {
  lang: string;
  hasPhone?: boolean;
}

const API_URL = BACKEND_URL;

function parsePreferences(value: unknown, ownerId: number | undefined): MarketingPreferencesData {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  const data = value as Record<string, unknown>;
  const dateOrNull = (field: unknown) => field === null || typeof field === "string";
  if (!ownerId || data.userId !== ownerId ||
      ![data.accountUpdates,data.specialOffers,data.partnerRecommendations,data.smsMarketing].every(flag => typeof flag === "boolean") ||
      ![data.createdAt,data.updatedAt,data.smsMarketingGrantedAt,data.smsMarketingRevokedAt,data.smsMarketingConsentVersion].every(dateOrNull)) {
    throw new Error();
  }
  return {
    userId: ownerId, accountUpdates: data.accountUpdates === true,
    specialOffers: data.specialOffers === true, partnerRecommendations: data.partnerRecommendations === true,
    smsMarketing: data.smsMarketing === true,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    smsMarketingGrantedAt: typeof data.smsMarketingGrantedAt === "string" ? data.smsMarketingGrantedAt : null,
    smsMarketingRevokedAt: typeof data.smsMarketingRevokedAt === "string" ? data.smsMarketingRevokedAt : null,
    smsMarketingConsentVersion: typeof data.smsMarketingConsentVersion === "string" ? data.smsMarketingConsentVersion : null,
  };
}

export default function MarketingPreferencesPanel({
  lang,
  hasPhone = false,
}: MarketingPreferencesPanelProps) {
  const { token, user } = useAuth();
  const lifetime = useRef<AbortController | null>(null);
  const normalizedLang = (lang || "EN").toUpperCase();
  const languageKey = normalizedLang as keyof typeof translations;
  const t = translations[languageKey] ?? translations.EN;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preferences, setPreferences] =
    useState<MarketingPreferencesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    setPreferences(null);
    const fetchPreferences = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await backendFetch(
          `${API_URL}/user/marketing-preferences`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (controller.signal.aborted) return;
        if (!response.ok) {
          if (response.status === 401) {
            setError("Unauthorized. Please log in again.");
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (controller.signal.aborted) return;
        setPreferences(parsePreferences(data, user?.id));
      } catch {
        if (!controller.signal.aborted) setError(t.preferencesError);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    fetchPreferences();
    return () => controller.abort();
  }, [token, user?.id, t.preferencesError]);

  const handleSavePreferences = async (
    formData: MarketingPreferencesFormData
  ) => {
    const controller = lifetime.current;
    if (!token || !controller || controller.signal.aborted) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await backendFetch(
        `${API_URL}/user/marketing-preferences`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        throw new Error(t.preferencesError);
      }

      const data = await response.json();
      if (controller.signal.aborted) throw new Error(t.preferencesError);
      setPreferences(parsePreferences(data, user?.id));
      setError(null);
    } catch {
      throw new Error(t.preferencesError);
    }
  };

  if (!token) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "#666",
        }}
      >
        {t.creating}
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          padding: "20px",
          background: "#f9f9f9",
          borderRadius: "8px",
          border: "1px solid #eee",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {t.marketingPreferences}
          </h3>
          <button
            disabled={!preferences || Boolean(error)}
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: "8px 16px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Edit
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "12px",
              background: "#ffcdd2",
              color: "#c62828",
              borderRadius: "4px",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            ✕ {error}
          </div>
        )}

        {preferences && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Account Updates */}
            <div
              style={{
                padding: "12px",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>
                  {t.accountUpdates}
                </span>
                <span
                  style={{
                    color: "#2196F3",
                    fontWeight: 600,
                  }}
                >
                  ✓ {t.enabled}
                </span>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#666",
                  marginTop: "4px",
                }}
              >
                {t.mandatory}
              </div>
            </div>

            {/* Special Offers */}
            <div
              style={{
                padding: "12px",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>
                  {t.specialOffers}
                </span>
                <span
                  style={{
                    color: preferences.specialOffers
                      ? "#2196F3"
                      : "#999",
                    fontWeight: 600,
                  }}
                >
                  {preferences.specialOffers ? "✓" : "✕"}
                  {preferences.specialOffers ? t.enabled : t.disabled}
                </span>
              </div>
            </div>

            {/* Partner Recommendations */}
            <div
              style={{
                padding: "12px",
                background: "white",
                borderRadius: "6px",
                border: "1px solid #e0e0e0",
                fontSize: "14px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>
                  {t.partnerRecommendations}
                </span>
                <span
                  style={{
                    color: preferences.partnerRecommendations
                      ? "#2196F3"
                      : "#999",
                    fontWeight: 600,
                  }}
                >
                  {preferences.partnerRecommendations ? "✓" : "✕"}
                  {preferences.partnerRecommendations
                    ? t.enabled
                    : t.disabled}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <MarketingPreferencesModal
        hasPhone={hasPhone}
        lang={normalizedLang}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePreferences}
        initialData={preferences || undefined}
      />
    </>
  );
}
