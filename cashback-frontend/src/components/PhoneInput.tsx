import React from "react";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

interface Props {
  id: string;
  country: CountryCode;
  onCountry: (value: CountryCode) => void;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  label: string;
  countryLabel: string;
  locale: string;
  error?: string;
  disabled?: boolean;
}

export default function PhoneInput(props: Props) {
  // Optional browser API, typed structurally to keep the existing ES2020 target.
  const DisplayNames = (Intl as typeof Intl & { DisplayNames?: new (
    locales: string[], options: {type: "region"}
  ) => {of: (code: string) => string | undefined} }).DisplayNames;
  const locale = ["en","ru","de","fr"].includes(props.locale.toLowerCase()) ? props.locale.toLowerCase() : "en";
  const names = DisplayNames ? new DisplayNames([locale], {type:"region"}) : null;
  return <div>
    <label htmlFor={`${props.id}-country`}>{props.countryLabel}</label>
    <select id={`${props.id}-country`} value={props.country} disabled={props.disabled}
      onChange={event => {
        const code = getCountries().find(country => country === event.target.value);
        if (code) props.onCountry(code);
      }} style={{display:"block",width:"100%",padding:12,marginBottom:8}}>
      {getCountries().map(country => <option key={country} value={country}>
        {names?.of(country) ?? (country === "GB" ? "United Kingdom" : country)} (+{getCountryCallingCode(country)})
      </option>)}
    </select>
    <label htmlFor={props.id}>{props.label}</label>
    <input id={props.id} name="phone_e164" type="tel" autoComplete="tel" required maxLength={64}
      value={props.value} disabled={props.disabled} onChange={event => props.onChange(event.target.value)} onBlur={props.onBlur}
      aria-invalid={Boolean(props.error)} aria-describedby={props.error ? `${props.id}-error` : undefined}
      style={{display:"block",width:"100%",boxSizing:"border-box",padding:12}} />
    {props.error && <p id={`${props.id}-error`} role="alert">{props.error}</p>}
  </div>;
}
