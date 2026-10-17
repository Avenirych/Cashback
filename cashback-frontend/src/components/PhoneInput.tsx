import React from "react";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
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
  const options = React.useMemo(() => countryOptions(props.locale), [props.locale]);
  return <div>
    <label htmlFor={props.id}>{props.label}</label>
    <div style={{display:"flex", border:"1px solid #ddd", borderRadius:6}}>
    <Select
      id={`${props.id}-country`} value={props.country} disabled={props.disabled}
      inputProps={{"aria-label": props.countryLabel}}
      onChange={event => {
        const code = getCountries().find(country => country === event.target.value);
        if (code) props.onCountry(code);
      }}
      renderValue={country => <span style={{display:"inline-flex",alignItems:"center",gap:8}}>
        <CountryFlag key={country} country={country} />
        <span style={{position:"absolute",width:1,height:1,padding:0,margin:-1,overflow:"hidden",clip:"rect(0, 0, 0, 0)",whiteSpace:"nowrap",border:0}}>
          {options.find(option => option.country === country)?.name}
        </span>
        +{getCountryCallingCode(country)}
      </span>}
      MenuProps={{slotProps:{paper:{style:{maxHeight:320,maxWidth:"calc(100vw - 32px)"}}}}}
      sx={{flexShrink:0, borderRadius:"6px 0 0 6px", borderRight:"1px solid #ddd",
        "& .MuiOutlinedInput-notchedOutline":{border:0},
        "&.Mui-focused .MuiOutlinedInput-notchedOutline":{border:"2px solid #0d6efd"},
        "& .MuiSelect-select":{padding:"12px 32px 12px 10px",display:"flex",alignItems:"center"}}}
    >
      {options.map(({country, name}) => <MenuItem key={country} value={country}
        sx={{gap:1,whiteSpace:"normal"}}>
        <CountryFlag country={country} /> <span>{name} (+{getCountryCallingCode(country)})</span>
      </MenuItem>)}
    </Select>
    <input id={props.id} name="phone_e164" type="tel" autoComplete="tel" required maxLength={64}
      value={props.value} disabled={props.disabled} onChange={event => props.onChange(event.target.value)} onBlur={props.onBlur}
      aria-invalid={Boolean(props.error)} aria-describedby={props.error ? `${props.id}-error` : undefined}
      style={{display:"block",width:"100%",boxSizing:"border-box",padding:12,minWidth:0,flex:1,border:0,borderRadius:6}} />
    </div>
    {props.error && <p id={`${props.id}-error`} role="alert">{props.error}</p>}
  </div>;
}

/** Local SVGs avoid dependence on Windows emoji fonts and remote image services. */
function CountryFlag({country}: {country: CountryCode}) {
  const [failed, setFailed] = React.useState(false);
  return failed ? <span aria-hidden="true" style={{width:24,flexShrink:0}}>{country}</span> :
    <img src={`${process.env.PUBLIC_URL || ""}/flags/${country.toLowerCase()}.svg`}
      alt="" aria-hidden="true" width={24} height={18}
      style={{objectFit:"cover",flexShrink:0}} onError={() => setFailed(true)} />;
}

export function countryOptions(language: string) {
  const locale = ["en","ru","de","fr"].includes(language.toLowerCase()) ? language.toLowerCase() : "en";
  const DisplayNames = (Intl as typeof Intl & {DisplayNames?: new (locales: string[], options: {type: "region"}) => {of: (code: string) => string | undefined}}).DisplayNames;
  let names: {of: (code: string) => string | undefined} | undefined;
  try { names = DisplayNames ? new DisplayNames([locale], {type:"region"}) : undefined; } catch { /* ISO fallback */ }
  const options = getCountries().map(country => {
    let name: string = country === "GB" ? "United Kingdom" : country;
    try { name = names?.of(country) || name; } catch { /* ISO fallback */ }
    return {country, name};
  });
  let compare: (a: string, b: string) => number = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  try { compare = new Intl.Collator(locale).compare; } catch { /* deterministic fallback */ }
  return options.sort((a,b) => a.country === b.country ? 0 : a.country === "GB" ? -1 : b.country === "GB" ? 1 : compare(a.name,b.name) || compare(a.country,b.country));
}
