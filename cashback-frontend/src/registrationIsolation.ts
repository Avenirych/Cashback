/** Nonempty values except explicit false block bonus traffic, including typos. */
export function registrationIsolated(): boolean {
  const value = process.env.REACT_APP_REGISTRATION_ISOLATED;
  return value !== undefined && value !== '' && value !== 'false';
}
export function assertBonusNetworkAllowed(): void {
  if (registrationIsolated()) throw new Error('Bonus API is disabled in isolated registration mode');
}
