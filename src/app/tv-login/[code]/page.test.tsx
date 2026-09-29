import React, { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TvApprovalPage from './page';

const mocks = vi.hoisted(() => ({
  approve: vi.fn(), getIdToken: vi.fn(),
  user: null as { email: string; getIdToken: () => Promise<string> } | null,
}));
vi.mock('@/actions/tv-auth', () => ({ approveTvSession: mocks.approve }));
vi.mock('@/firebase', () => ({ useUser: () => ({ user: mocks.user }) }));

const code = 'a'.repeat(32);
let element: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.resetAllMocks();
  mocks.getIdToken.mockResolvedValue('verified-phone-token');
  mocks.approve.mockResolvedValue({ success: true });
  mocks.user = { email: 'person@example.test', getIdToken: mocks.getIdToken };
  element = document.createElement('div');
  document.body.appendChild(element);
  root = createRoot(element);
});

afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

async function render(pairingCode = code) {
  const params = Promise.resolve({ code: pairingCode });
  await act(async () => root.render(<Suspense fallback="Carregando"><TvApprovalPage params={params} /></Suspense>));
}

describe('phone confirmation for TV access', () => {
  it('shows the account and requires a deliberate confirmation before requesting its token', async () => {
    await render();
    expect(element.textContent).toContain('person@example.test');
    expect(element.textContent).toContain('permissões da sua conta');
    expect(mocks.getIdToken).not.toHaveBeenCalled();
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/');
    await act(async () => element.querySelector('button')!.click());
    expect(mocks.approve).toHaveBeenCalledExactlyOnceWith(code, 'verified-phone-token');
    expect(element.textContent).toContain('TV autorizada');
    expect(element.querySelector('button')).toBeNull();
  });

  it.each(['ABC123', '../admin'])('does not authorize a malformed code %s', async invalid => {
    await render(invalid);
    expect(element.querySelector('button')?.disabled).toBe(true);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Código inválido');
    await act(async () => element.querySelector('button')!.click());
    expect(mocks.getIdToken).not.toHaveBeenCalled();
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it('cannot confirm without an authenticated account', async () => {
    mocks.user = null;
    await render();
    expect(element.querySelector('button')?.disabled).toBe(true);
    await act(async () => element.querySelector('button')!.click());
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it('prevents repeated confirmation while waiting and permits retry after a connection error', async () => {
    let reject!: (error: Error) => void;
    mocks.approve.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await render();
    await act(async () => element.querySelector('button')!.click());
    expect(element.querySelector('button')?.disabled).toBe(true);
    await act(async () => element.querySelector('button')!.click());
    expect(mocks.approve).toHaveBeenCalledOnce();
    await act(async () => reject(new Error('network unavailable')));
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Falha de conexão');
    expect(element.querySelector('button')?.disabled).toBe(false);
    await act(async () => element.querySelector('button')!.click());
    expect(mocks.approve).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('TV autorizada');
  });
});
