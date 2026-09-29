// @vitest-environment node
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approveTvSession, createTvSession, redeemTvSession } from './tv-auth';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), verifyIdToken: vi.fn(), createCustomToken: vi.fn(), runTransaction: vi.fn(),
  record: {} as Record<string, unknown>, profile: { role: 'ENGINEER' } as Record<string, unknown>, writes: [] as Record<string, unknown>[],
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken: mocks.verifyIdToken, createCustomToken: mocks.createCustomToken },
  adminDb: {
    collection: (collection: string) => ({ doc: (id: string) => ({ collection, id, create: mocks.create }) }),
    runTransaction: mocks.runTransaction,
  },
}));

const code = 'a'.repeat(32);
const verifier = 'b'.repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.record = { status: 'pending', expiresAt: new Date(Date.now() + 300_000),
    verifierHash: createHash('sha256').update(verifier).digest('hex') };
  mocks.profile = { role: 'ENGINEER' };
  mocks.writes = [];
  mocks.create.mockResolvedValue(undefined);
  mocks.verifyIdToken.mockResolvedValue({ uid: 'verified-user' });
  mocks.createCustomToken.mockResolvedValue('synthetic-custom-token');
  mocks.runTransaction.mockImplementation(async action => action({
    get: async (ref: { collection: string }) => ({ exists: true, data: () => ref.collection === 'users' ? mocks.profile : mocks.record }),
    update: (_ref: unknown, data: Record<string, unknown>) => {
      mocks.writes.push(data); Object.assign(mocks.record, data);
    },
  }));
});

describe('TV pairing', () => {
  it('creates separate random pairing and redemption secrets with a five-minute expiry', async () => {
    const result = await createTvSession();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(result.code).toMatch(/^[a-f0-9]{32}$/);
    expect(result.verifier).toMatch(/^[a-f0-9]{64}$/);
    expect(result.expiresAt - Date.now()).toBeGreaterThan(299_000);
    expect(result.expiresAt - Date.now()).toBeLessThanOrEqual(300_000);
    const stored = mocks.create.mock.calls[0][0];
    expect(stored.verifierHash).toBe(createHash('sha256').update(result.verifier).digest('hex'));
    expect(stored).not.toHaveProperty('verifier');
    expect(stored).not.toHaveProperty('customToken');
  });

  it('approves only the identity verified by Firebase and checks token revocation', async () => {
    await expect(approveTvSession(code, 'phone-id-token')).resolves.toEqual({ success: true });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('phone-id-token', true);
    expect(mocks.record).toMatchObject({ status: 'approved', authorizedByUid: 'verified-user' });
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });

  it('rejects an unprovisioned account and a repeated or expired approval', async () => {
    mocks.profile = {};
    expect((await approveTvSession(code, 'token')).success).toBe(false);
    mocks.profile = { role: 'ENGINEER' };
    mocks.record.expiresAt = new Date(Date.now() - 1);
    expect((await approveTvSession(code, 'token')).success).toBe(false);
    mocks.record.expiresAt = new Date(Date.now() + 10_000);
    mocks.record.status = 'approved';
    expect((await approveTvSession(code, 'token')).success).toBe(false);
    expect(mocks.writes).toHaveLength(0);
  });

  it('requires the TV-only verifier even when a caller knows the QR code', async () => {
    mocks.record.status = 'approved';
    mocks.record.authorizedByUid = 'verified-user';
    expect((await redeemTvSession(code, 'c'.repeat(64))).status).toBe('expired');
    expect(mocks.writes).toHaveLength(0);
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });

  it('returns pending without producing a token before phone approval', async () => {
    await expect(redeemTvSession(code, verifier)).resolves.toEqual({ status: 'pending' });
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });

  it('consumes the session before minting a token and prevents replay', async () => {
    Object.assign(mocks.record, { status: 'approved', authorizedByUid: 'verified-user' });
    mocks.createCustomToken.mockImplementation(async () => {
      expect(mocks.record.status).toBe('consumed');
      return 'synthetic-custom-token';
    });
    await expect(redeemTvSession(code, verifier)).resolves.toEqual({ status: 'authenticated', customToken: 'synthetic-custom-token' });
    expect((await redeemTvSession(code, verifier)).status).toBe('expired');
    expect(mocks.createCustomToken).toHaveBeenCalledExactlyOnceWith('verified-user');
    expect(JSON.stringify(mocks.writes)).not.toContain('synthetic-custom-token');
  });

  it('fails closed if token creation fails after consumption', async () => {
    Object.assign(mocks.record, { status: 'approved', authorizedByUid: 'verified-user' });
    mocks.createCustomToken.mockRejectedValue(new Error('private provider detail'));
    const result = await redeemTvSession(code, verifier);
    expect(result.status).toBe('expired');
    expect(mocks.record.status).toBe('consumed');
    expect(JSON.stringify(result)).not.toContain('private provider detail');
  });

  it('rechecks profile access at redemption and rejects invalid expiration dates', async () => {
    Object.assign(mocks.record, { status: 'approved', authorizedByUid: 'verified-user' });
    mocks.profile = { role: 'USER' };
    expect((await redeemTvSession(code, verifier)).status).toBe('expired');
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
    mocks.profile = { role: 'ENGINEER' };
    mocks.record.expiresAt = { toMillis: () => Number.NaN };
    expect((await redeemTvSession(code, verifier)).status).toBe('expired');
    expect(mocks.createCustomToken).not.toHaveBeenCalled();
  });

  it.each(['', 'ABC123', '../other', 'a'.repeat(33)])('rejects malformed code %s before any database or auth operation', async invalidCode => {
    expect((await approveTvSession(invalidCode, 'token')).success).toBe(false);
    expect((await redeemTvSession(invalidCode, verifier)).status).toBe('expired');
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('does not disclose server errors when session creation fails', async () => {
    mocks.create.mockRejectedValue(new Error('secret service-account data'));
    const result = await createTvSession();
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret service-account');
  });
});
