/** Ignore request origins except for the explicitly isolated historical local environment. */
export function verificationFrontendOrigin(requestOrigin?: string, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.FRONTEND_URL || 'http://localhost:3000';
  if (env.NODE_ENV === 'development' && env.HISTORICAL_LOCAL === 'true' && env.FRONTEND_URL === 'http://localhost:3004' &&
      (requestOrigin === 'http://127.0.0.1:3005' || requestOrigin === 'http://localhost:3005')) {
    return requestOrigin;
  }
  return configured;
}
