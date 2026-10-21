import { BadRequestException } from '@nestjs/common';
import { parsePhoneNumberWithError } from 'libphonenumber-js/max';

/** International input only. No country guessing, extensions or text extraction. */
export function normalizePhone(value: unknown): string {
  const invalid = () => new BadRequestException('A valid international phone number is required');
  if (typeof value !== 'string' || value.length > 64) throw invalid();
  const input = value.trim();
  if (!/^\+[0-9 ()-]+$/.test(input)) throw invalid();
  try {
    const phone = parsePhoneNumberWithError(input, { extract: false });
    if (phone.ext || !phone.isValid() || !/^\+[1-9][0-9]{1,14}$/.test(phone.number)) throw invalid();
    return phone.number;
  } catch {
    // Parser errors may contain input; never propagate them.
    throw invalid();
  }
}
