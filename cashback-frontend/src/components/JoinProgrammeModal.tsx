import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AUTH_API, useAuth } from "../context/AuthContext";
import { translations } from "../i18n";

export interface OnboardingState {
  bonusEligible: boolean;
  noticeVersion: "2026-10-draft";
  termsVersion: "2026-10-draft";
  recipient?: {
    accountHolderNameMasked: string;
    sortCodeMasked: string;
    accountNumberMasked: string;
  };
}

export function isOnboardingState(value: any): value is OnboardingState {
  return value != null && typeof value.bonusEligible === "boolean" &&
    value.noticeVersion === "2026-10-draft" && value.termsVersion === "2026-10-draft" &&
    (value.recipient === undefined || (value.recipient != null &&
      ["accountHolderNameMasked", "sortCodeMasked", "accountNumberMasked"]
        .every((key) => typeof value.recipient[key] === "string")));
}

export default function JoinProgrammeModal({
  t, onClose,
}: { t: typeof translations.EN; onClose: () => void }) {
  const { token, refreshUser } = useAuth();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const controller = useRef(new AbortController());
  const [holder, setHolder] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [account, setAccount] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    controller.current = new AbortController();
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    const abort = controller.current;
    return () => {
      abort.abort();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (saving) dialog.current?.focus();
  }, [saving]);

  const handleKeys = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && !pending.current) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]',
    ) ?? []);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
      event.preventDefault();
      first?.focus();
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    const canonicalSortCode = sortCode.replace(/[ -]/g, "");
    const invalidName = Array.from(holder).some((character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
    if (holder.trim().length < 2 || holder.trim().length > 120 || invalidName ||
      !/^[0-9 -]+$/.test(sortCode) || !/^\d{6}$/.test(canonicalSortCode) ||
      !/^\d{8}$/.test(account) || !privacy || !accuracy) {
      setError(t.onboarding.invalid);
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${AUTH_API}/onboarding`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        signal: controller.current.signal,
        body: JSON.stringify({
          programmeOptIn: true, privacyAcknowledged: true, accuracyConfirmed: true,
          accountHolderName: holder.trim(), sortCode: canonicalSortCode, accountNumber: account,
        }),
      });
      if (!response.ok) throw new Error("Enrolment unavailable");
      const result = await response.json();
      if (!isOnboardingState(result) || !result.bonusEligible || !result.recipient) {
        throw new Error("Enrolment unavailable");
      }
      if (controller.current.signal.aborted) return;
      const refreshed = await refreshUser();
      if (controller.current.signal.aborted) return;
      if (refreshed.bonusEligible !== true) throw new Error("Enrolment unavailable");
      setHolder("");
      setSortCode("");
      setAccount("");
      onClose();
      navigate("/", { replace: true });
    } catch {
      if (!controller.current.signal.aborted) setError(t.onboarding.failure);
    } finally {
      pending.current = false;
      if (!controller.current.signal.aborted) setSaving(false);
    }
  };

  return (
    <div className="programme-overlay">
      <div ref={dialog} className="programme-dialog" role="dialog" aria-modal="true"
        aria-labelledby="programme-title" aria-describedby="programme-intro" tabIndex={-1}
        onKeyDown={handleKeys}>
        <h2 id="programme-title">{t.onboarding.join}</h2>
        <p id="programme-intro">{t.onboarding.intro}</p>
        <p>{t.onboarding.capture}</p>
        <p>
          <Link to="/privacy" target="_blank" rel="noopener noreferrer">{t.onboarding.privacy}</Link>
          {" · "}
          <Link to="/programme" target="_blank" rel="noopener noreferrer">{t.onboarding.terms}</Link>
        </p>
        <form onSubmit={submit} noValidate aria-busy={saving}>
          <label htmlFor="account-holder">{t.onboarding.holder}</label>
          <input id="account-holder" value={holder} onChange={(e) => setHolder(e.target.value)}
            autoComplete="off" maxLength={120} disabled={saving} required />
          <label htmlFor="sort-code">{t.onboarding.sortCode}</label>
          <input id="sort-code" value={sortCode} onChange={(e) => setSortCode(e.target.value)}
            autoComplete="off" inputMode="numeric" maxLength={12} disabled={saving} required />
          <label htmlFor="account-number">{t.onboarding.account}</label>
          <input id="account-number" value={account} onChange={(e) => setAccount(e.target.value)}
            autoComplete="off" inputMode="numeric" maxLength={8} disabled={saving} required />
          <label className="programme-confirmation">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)}
              disabled={saving} />{t.onboarding.privacyAck}
          </label>
          <label className="programme-confirmation">
            <input type="checkbox" checked={accuracy} onChange={(e) => setAccuracy(e.target.checked)}
              disabled={saving} />{t.onboarding.accuracy}
          </label>
          {error && <p role="alert" className="programme-error">{error}</p>}
          <div className="programme-actions">
            <button type="submit" disabled={saving}>{saving ? t.creating : t.onboarding.save}</button>
            <button type="button" onClick={onClose} disabled={saving}>{t.cancel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
