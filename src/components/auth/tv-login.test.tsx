import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Auth } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TvLogin } from './tv-login';

const mocks = vi.hoisted(() => ({ create: vi.fn(), redeem: vi.fn(), signIn: vi.fn() }));
vi.mock('@/actions/tv-auth', () => ({ createTvSession: mocks.create, redeemTvSession: mocks.redeem }));
vi.mock('firebase/auth', () => ({ signInWithCustomToken: mocks.signIn }));
vi.mock('qrcode.react', () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-pairing-url={value} /> }));

const auth = {} as Auth;
const code = 'a'.repeat(32);
const verifier = 'b'.repeat(64);
let element: HTMLDivElement;
let root: Root;
let mounted = true;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ success: true, code, verifier, expiresAt: Date.now() + 300_000 });
  mocks.redeem.mockResolvedValue({ status: 'pending' });
  mocks.signIn.mockResolvedValue(undefined);
  element = document.createElement('div');
  document.body.appendChild(element);
  root = createRoot(element);
  mounted = true;
});
afterEach(async () => {
  if (mounted) await act(async () => root.unmount());
  element.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TV login interface', () => {
  it('puts only the code in the QR and signs in only after verified redemption', async () => {
    const onAuthenticated = vi.fn();
    await act(async () => root.render(<TvLogin auth={auth} onAuthenticated={onAuthenticated} />));
    const url = element.querySelector('svg')?.getAttribute('data-pairing-url');
    expect(url).toBe(`${window.location.origin}/tv-login/${code}`);
    expect(url).not.toContain(verifier);
    expect(mocks.signIn).not.toHaveBeenCalled();
    mocks.redeem.mockResolvedValueOnce({ status: 'authenticated', customToken: 'synthetic-token' });
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(mocks.redeem).toHaveBeenCalledExactlyOnceWith(code, verifier);
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith(auth, 'synthetic-token');
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it('ignores a late token response after the TV tab is closed', async () => {
    let finish!: (value: { status: string; customToken: string }) => void;
    mocks.redeem.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const onAuthenticated = vi.fn();
    await act(async () => root.render(<TvLogin auth={auth} onAuthenticated={onAuthenticated} />));
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    await act(async () => root.unmount());
    mounted = false;
    await act(async () => finish({ status: 'authenticated', customToken: 'late-token' }));
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('shows expiration and allows generating a new code', async () => {
    const onAuthenticated = vi.fn();
    mocks.redeem.mockResolvedValueOnce({ status: 'expired', error: 'Código expirado.' });
    await act(async () => root.render(<TvLogin auth={auth} onAuthenticated={onAuthenticated} />));
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(element.textContent).toContain('Código expirado.');
    expect(element.querySelector('svg[data-pairing-url]')).toBeNull();
    await act(async () => element.querySelector('button')!.click());
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('Aguardando sua confirmação');
  });
});
