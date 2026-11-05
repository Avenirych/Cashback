/** Pure shared JWT configuration validation: no environment reads or key rewriting. */
export interface JwtConfigurationInput { readonly secret: unknown }
export interface ValidatedJwtConfiguration { readonly secret: string }

export function validateJwtConfigurationInput(
  input: JwtConfigurationInput,
): Readonly<ValidatedJwtConfiguration> {
  const secret = input.secret;
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new Error('JWT_SECRET must be configured and nonblank');
  }
  if (/[\r\n\0]/.test(secret)) {
    throw new Error('JWT_SECRET must not contain control characters');
  }
  // Preserve the exact key used by existing JWTs and Activity HMAC identities.
  return Object.freeze({ secret });
}
