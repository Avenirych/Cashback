import { BACKEND_URL, backendFetch } from "../backend";
import React, { useEffect, useRef, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import PhoneInput from "./PhoneInput";
import { canonicalPhone } from "../utils/phone";
import { translations } from "../i18n";

interface PhoneProfile {
  phone_e164: string | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
}
interface Props {
  userId: number;
  token: string;
  lang: string;
  phone: string | null;
  verified: boolean;
  ready: boolean;
  onSaved: (profile: PhoneProfile) => void;
}

/** No browser storage and no phone value in diagnostics. */
export default function OwnPhonePanel(props: Props) {
  const t = translations[props.lang.toUpperCase() as keyof typeof translations] ?? translations.EN;
  const [value, setValue] = useState(props.phone ?? "");
  const [country, setCountry] = useState<CountryCode>("GB");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => { setValue(props.phone ?? ""); }, [props.phone]);
  useEffect(() => () => { request.current?.abort(); }, []);
  const canonical = canonicalPhone(value, country);

  const save = async () => {
    setTouched(true);
    if (!canonical || !props.ready || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage("");
    try {
      const response = await backendFetch(`${BACKEND_URL}/users/${props.userId}`, {
        method: "PATCH", signal: controller.signal,
        headers: {Authorization: `Bearer ${props.token}`, "Content-Type": "application/json"},
        body: JSON.stringify({phone_e164: canonical}),
      });
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (!data || typeof data !== "object") throw new Error();
      const profile = data as Record<string, unknown>;
      if (profile.id !== props.userId || profile.phone_e164 !== canonical ||
          typeof profile.phone_verified !== "boolean" ||
          !(profile.phone_verified_at === null || typeof profile.phone_verified_at === "string")) throw new Error();
      props.onSaved({phone_e164: canonical, phone_verified: profile.phone_verified === true,
        phone_verified_at: typeof profile.phone_verified_at === "string" ? profile.phone_verified_at : null});
      setMessage(t.phoneSaved);
    } catch {
      if (!controller.signal.aborted) setMessage(t.phoneSaveError);
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  };

  return <section aria-label={t.phone}>
    <p data-testid="profile-phone">{props.phone || t.phoneMissing}</p>
    {props.phone && <p>{props.verified ? t.phoneVerified : t.phoneUnverified}</p>}
    <PhoneInput id="profile-phone-input" value={value} onChange={value => {setValue(value);setTouched(true);setMessage("");}}
      onBlur={() => setTouched(true)}
      country={country} onCountry={setCountry} locale={props.lang} label={t.phone} countryLabel={t.phoneCountry}
      disabled={busy || !props.ready}
      error={touched && !canonical ? (value.trim() ? t.phoneInvalid : t.phoneRequired) : undefined} />
    <button type="button" disabled={busy || !canonical || !props.ready} onClick={() => { void save(); }}>{t.phoneSave}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
