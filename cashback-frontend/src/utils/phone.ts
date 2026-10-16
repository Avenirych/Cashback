import { parsePhoneNumberWithError } from "libphonenumber-js/max";
import type { CountryCode } from "libphonenumber-js";

/** Same max metadata/version as backend; national input requires an explicit country. */
export function canonicalPhone(value: string, country: CountryCode): string | null {
  if (value.length > 64 || !/^\+?[0-9 ()-]+$/.test(value.trim())) return null;
  try {
    const phone = parsePhoneNumberWithError(value.trim(), { defaultCountry: country, extract: false });
    return !phone.ext && phone.isValid() && /^\+[1-9][0-9]{1,14}$/.test(phone.number)
      ? phone.number : null;
  } catch {
    return null;
  }
}
