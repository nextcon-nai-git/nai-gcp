/** Only the known pairing route may be resumed after password authentication. */
export function loginDestination(search: string): string {
  const next = new URLSearchParams(search).get('returnTo');
  return next && /^\/tv-login\/[a-f0-9]{32}$/.test(next) ? next : '/';
}
