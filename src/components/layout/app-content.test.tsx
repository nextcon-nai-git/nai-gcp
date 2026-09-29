import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContent } from './app-content';

const state = vi.hoisted(() => ({
  user: null as { uid: string } | null,
  role: null as string | null,
  isUserLoading: false,
  userError: null as Error | null,
  pathname: '/clients',
  replace: vi.fn(),
}));
vi.mock('@/firebase', () => ({ useUser: () => state, useAuth: () => ({}) }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock('@/components/layout/top-nav', () => ({ TopNav: () => null }));
vi.mock('@/components/layout/app-sidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/commercial/nai-floating-widget', () => ({ NaiFloatingWidget: () => null }));
vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => children,
  SidebarInset: ({ children }: { children: React.ReactNode }) => children,
}));

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.assign(state, { user: null, role: null, isUserLoading: false, userError: null, pathname: '/clients' });
  state.replace.mockClear();
  element = document.createElement('div');
  document.body.appendChild(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

async function renderProtectedChild() {
  const mounted = vi.fn();
  function Protected() { mounted(); return <p>Protected data</p>; }
  await act(async () => root.render(<AppContent><Protected /></AppContent>));
  return mounted;
}

describe('application access gate', () => {
  it('never mounts protected children while redirecting a signed-out account', async () => {
    const mounted = await renderProtectedChild();
    expect(mounted).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledWith('/login');
  });

  it('preserves a valid TV approval route through the login redirect', async () => {
    state.pathname = `/tv-login/${'a'.repeat(32)}`;
    const mounted = await renderProtectedChild();
    expect(mounted).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent(state.pathname)}`);
  });

  it('does not forward an invalid pairing path as a login destination', async () => {
    state.pathname = '/tv-login/invalid-code';
    await renderProtectedChild();
    expect(state.replace).toHaveBeenCalledWith('/login');
  });

  it.each([null, 'USER'])('explains pending access for an unprovisioned profile (%s)', async role => {
    state.user = { uid: 'alice' };
    state.role = role;
    const mounted = await renderProtectedChild();
    expect(mounted).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Sua conta aguarda liberação');
    expect(element.textContent).toContain('Verificar novamente');
  });

  it('shows recovery controls without mounting protected data after a profile failure', async () => {
    state.user = { uid: 'alice' };
    state.userError = new Error('profile unavailable');
    const mounted = await renderProtectedChild();
    expect(mounted).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Não foi possível carregar seu acesso');
    expect(element.textContent).toContain('Sair da conta');
  });

  it('renders a provisioned account and keeps the login page available', async () => {
    state.user = { uid: 'alice' };
    state.role = 'ENGINEER';
    expect(await renderProtectedChild()).toHaveBeenCalled();
    state.user = null;
    state.role = null;
    state.pathname = '/login';
    await act(async () => root.render(<AppContent><p>Login form</p></AppContent>));
    expect(element.textContent).toContain('Login form');
  });
});
