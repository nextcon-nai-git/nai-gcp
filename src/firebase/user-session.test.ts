import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { ensureUserProfile, subscribeToUserSession, type UserAuthState } from './user-session';

const mocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(), onSnapshot: vi.fn(), runTransaction: vi.fn(),
  get: vi.fn(), set: vi.fn(), stopAuth: vi.fn(),
}));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: mocks.onAuthStateChanged }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, _collection: string, uid: string) => ({ id: uid }),
  onSnapshot: mocks.onSnapshot,
  runTransaction: mocks.runTransaction,
  serverTimestamp: () => 'server-time',
}));

const auth = {} as Auth;
const db = {} as Firestore;
const user = (uid = 'alice') => ({
  uid, email: `${uid}@example.test`, displayName: 'Conta de teste',
  getIdTokenResult: vi.fn().mockResolvedValue({ claims: { role: 'ADMIN', companyId: 'old' } }),
}) as unknown as User;
const profile = (data: Record<string, unknown> | null) => ({ exists: () => data !== null, data: () => data });
const authChange = () => mocks.onAuthStateChanged.mock.calls[0][1] as (user: User | null) => Promise<void>;
const profileChange = (index = 0) => mocks.onSnapshot.mock.calls[index][1] as (snapshot: ReturnType<typeof profile>) => void;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue(profile(null));
  mocks.runTransaction.mockImplementation((_db, action) => action({ get: mocks.get, set: mocks.set }));
  mocks.onAuthStateChanged.mockReturnValue(mocks.stopAuth);
  mocks.onSnapshot.mockImplementation(() => vi.fn());
});

describe('safe profile bootstrap', () => {
  it('creates only basic fields without assigning role or tenant privileges', async () => {
    await ensureUserProfile(db, user());
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith({ id: 'alice' }, {
      id: 'alice', email: 'alice@example.test', name: 'Conta de teste', updatedAt: 'server-time',
    });
  });

  it('does not overwrite an existing provisioned profile', async () => {
    mocks.get.mockResolvedValue(profile({ role: 'DOCTOR', companyId: 'clinic' }));
    await ensureUserProfile(db, user());
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('does not create a malformed profile for an account without an email', async () => {
    await expect(ensureUserProfile(db, { ...user(), email: null })).rejects.toThrow('e-mail');
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('propagates transaction failures without a nontransactional overwrite', async () => {
    mocks.runTransaction.mockRejectedValue(new Error('offline'));
    await expect(ensureUserProfile(db, user())).rejects.toThrow('offline');
    expect(mocks.set).not.toHaveBeenCalled();
  });
});

describe('session lifecycle', () => {
  it('clears access while loading and uses the current profile instead of old token claims', async () => {
    const publish = vi.fn<(state: UserAuthState) => void>();
    subscribeToUserSession(auth, db, publish);
    await authChange()(user());
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ role: null, companyId: null, isUserLoading: true }));
    profileChange()(profile({ role: 'DOCTOR', companyId: 'clinic' }));
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'DOCTOR', companyId: 'clinic', isUserLoading: false }));
  });

  it('unsubscribes and ignores a late snapshot after logout', async () => {
    const publish = vi.fn();
    subscribeToUserSession(auth, db, publish);
    await authChange()(user());
    const late = profileChange();
    await authChange()(null);
    expect(mocks.onSnapshot.mock.results[0].value).toHaveBeenCalledOnce();
    late(profile({ role: 'ADMIN', companyId: 'old' }));
    expect(publish).toHaveBeenLastCalledWith({ user: null, role: null, companyId: null, isUserLoading: false, userError: null });
  });

  it('ignores pending initialization from a previous user', async () => {
    let release!: () => void;
    mocks.runTransaction.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const publish = vi.fn();
    subscribeToUserSession(auth, db, publish);
    const pending = authChange()(user('alice'));
    await authChange()(user('bob'));
    release();
    await pending;
    expect(mocks.onSnapshot).toHaveBeenCalledOnce();
    expect(mocks.onSnapshot.mock.calls[0][0]).toEqual({ id: 'bob' });
    profileChange()(profile({ role: 'ENGINEER', companyId: 'bob-company' }));
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ user: expect.objectContaining({ uid: 'bob' }), companyId: 'bob-company' }));
  });

  it('disposes both subscriptions and ignores subsequent callbacks', async () => {
    const publish = vi.fn();
    const stop = subscribeToUserSession(auth, db, publish);
    await authChange()(user());
    stop();
    const count = publish.mock.calls.length;
    profileChange()(profile({ role: 'ADMIN' }));
    expect(mocks.stopAuth).toHaveBeenCalledOnce();
    expect(mocks.onSnapshot.mock.results[0].value).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledTimes(count);
  });

  it('clears a deleted or revoked profile even when token refresh fails', async () => {
    const account = user();
    vi.mocked(account.getIdTokenResult).mockRejectedValue(new Error('offline'));
    const publish = vi.fn();
    subscribeToUserSession(auth, db, publish);
    await authChange()(account);
    profileChange()(profile({ role: 'ADMIN', companyId: 'clinic' }));
    profileChange()(profile(null));
    await Promise.resolve();
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ role: null, companyId: null, userError: null }));
  });

  it('fails closed when the profile listener or bootstrap fails', async () => {
    const publish = vi.fn();
    subscribeToUserSession(auth, db, publish);
    await authChange()(user());
    mocks.onSnapshot.mock.calls[0][2](new Error('permission-denied'));
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ role: null, companyId: null, isUserLoading: false, userError: expect.any(Error) }));
    mocks.runTransaction.mockRejectedValueOnce('network failure');
    await authChange()(user('bob'));
    expect(publish).toHaveBeenLastCalledWith(expect.objectContaining({ role: null, companyId: null, userError: expect.any(Error) }));
  });
});
