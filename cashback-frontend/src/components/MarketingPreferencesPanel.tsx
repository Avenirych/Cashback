import React, { useState, useEffect } from "react";
import MarketingPreferencesModal from "./MarketingPreferencesModal";
import { translations } from "../i18n";
import { useAuth } from "../context/AuthContext";
import type {
  MarketingPreferencesData,
  MarketingPreferencesFormData,
} from "../types/MarketingPreferences";

interface MarketingPreferencesPanelProps {
  lang: string;
}

const API_URL = "http://localhost:3001";

export default function MarketingPreferencesPanel({
  lang,
}: MarketingPreferencesPanelProps) {
  const { token } = useAuth();
  const normalizedLang = (lang || "EN").toUpperCase();
  const languageKey = normalizedLang as keyof typeof translations;
  const t = translations[languageKey] ?? translations.EN;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preferences, setPreferences] =
    useState<MarketingPreferencesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `${API_URL}/user/marketing-preferences`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            setError("Unauthorized. Please log in again.");
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setPreferences(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        console.error("Marketing preferences error:", message);
        setError(`Failed to load preferences: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [token]);

  const handleSavePreferences = async (
    formData: MarketingPreferencesFormData
  ) => {
    if (!token) {
      throw new Error("Not authenticated");
    }

    try {
      const response = await fetch(
        `${API_URL}/user/marketing-preferences`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Save error response:", errorText);
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setPreferences(data);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      console.error("Save error:", message);
      throw new Error(`Failed to save: ${message}`);
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
        lang={normalizedLang}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePreferences}
        initialData={preferences || undefined}
      />
    </>
  );
}