/** Safe categories for login only; never expose backend response bodies. */
export type LoginFailureKind = 'credentials' | 'limited' | 'network' | 'server' | 'unknown';
export class LoginFailure extends Error {
  constructor(readonly kind: LoginFailureKind) { super('Login request failed'); this.name = 'LoginFailure'; }
}
