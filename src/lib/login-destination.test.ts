import { describe, expect, it } from 'vitest';
import { loginDestination } from './login-destination';

describe('login return destination', () => {
  it('resumes only a known TV pairing route', () => {
    const path = `/tv-login/${'a'.repeat(32)}`;
    expect(loginDestination(`?returnTo=${encodeURIComponent(path)}`)).toBe(path);
  });
  it.each(['https://attacker.test', '//attacker.test', '/clients', '/tv-login/ABC123', '/tv-login/../admin'])('rejects untrusted destination %s', path => {
    expect(loginDestination(`?returnTo=${encodeURIComponent(path)}`)).toBe('/');
  });
});
