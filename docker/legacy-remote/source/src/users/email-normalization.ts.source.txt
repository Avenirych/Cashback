/** Preserve the existing account-email policy; do not rewrite dots or aliases. */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
