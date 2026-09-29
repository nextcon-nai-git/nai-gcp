'use server';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

const TTL_MS = 5 * 60 * 1000;
const CODE = /^[a-f0-9]{32}$/;
const SECRET = /^[a-f0-9]{64}$/;
const ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS', 'CLIENT_ADMIN', 'DOCTOR', 'HEALTH_PROFESSIONAL', 'PROVIDER', 'ENGINEER']);
const invalid = 'Código da TV inválido, já utilizado ou expirado. Gere um novo código na TV.';

function expiresAtMillis(value: unknown): number {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const milliseconds: unknown = value.toMillis();
    return typeof milliseconds === 'number' && Number.isFinite(milliseconds) ? milliseconds : 0;
  }
  return 0;
}

/** The verifier stays on the TV; the QR code contains only a public pairing code. */
export async function createTvSession() {
  try {
    const code = randomBytes(16).toString('hex');
    const verifier = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + TTL_MS;
    await adminDb.collection('tv_auth_sessions').doc(code).create({
      status: 'pending', verifierHash: createHash('sha256').update(verifier).digest('hex'),
      createdAt: new Date(), expiresAt: new Date(expiresAt),
    });
    return { success: true as const, code, verifier, expiresAt };
  } catch {
    return { success: false as const, error: 'Não foi possível preparar o acesso da TV. Tente novamente.' };
  }
}

/** The phone approves its own verified identity, never a browser-supplied user ID. */
export async function approveTvSession(code: string, userIdToken: string) {
  if (!CODE.test(code) || typeof userIdToken !== 'string' || !userIdToken || userIdToken.length > 16_000) {
    return { success: false, error: invalid };
  }
  try {
    const identity = await adminAuth.verifyIdToken(userIdToken, true);
    const ref = adminDb.collection('tv_auth_sessions').doc(code);
    const profileRef = adminDb.collection('users').doc(identity.uid);
    await adminDb.runTransaction(async transaction => {
      const [snapshot, profile] = await Promise.all([transaction.get(ref), transaction.get(profileRef)]);
      const data = snapshot.data();
      if (!profile.exists || !ROLES.has(profile.data()?.role)) throw new Error('unprovisioned');
      if (!snapshot.exists || data?.status !== 'pending' || expiresAtMillis(data.expiresAt) <= Date.now()) throw new Error('invalid-session');
      transaction.update(ref, { status: 'approved', authorizedByUid: identity.uid, authorizedAt: new Date() });
    });
    return { success: true };
  } catch {
    return { success: false, error: 'Não foi possível autorizar. Confira seu acesso e gere um novo código na TV se ele expirou.' };
  }
}

/** Atomically consume before minting a token. A QR-code holder cannot redeem it. */
export async function redeemTvSession(code: string, verifier: string) {
  if (!CODE.test(code) || !SECRET.test(verifier)) return { status: 'expired' as const, error: invalid };
  try {
    const ref = adminDb.collection('tv_auth_sessions').doc(code);
    const uid = await adminDb.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      const expected = typeof data?.verifierHash === 'string' && SECRET.test(data.verifierHash)
        ? Buffer.from(data.verifierHash, 'hex') : null;
      const actual = createHash('sha256').update(verifier).digest();
      if (!snapshot.exists || !expected || !timingSafeEqual(expected, actual)
        || expiresAtMillis(data?.expiresAt) <= Date.now()) throw new Error('invalid-session');
      if (data?.status === 'pending') return null;
      if (data?.status !== 'approved' || typeof data.authorizedByUid !== 'string' || !data.authorizedByUid) throw new Error('invalid-session');
      const profile = await transaction.get(adminDb.collection('users').doc(data.authorizedByUid));
      if (!profile.exists || !ROLES.has(profile.data()?.role)) throw new Error('unprovisioned');
      transaction.update(ref, { status: 'consumed', consumedAt: new Date() });
      return data.authorizedByUid;
    });
    if (!uid) return { status: 'pending' as const };
    const customToken = await adminAuth.createCustomToken(uid);
    return { status: 'authenticated' as const, customToken };
  } catch {
    // Never expose SDK failures, tokens, account details or the verifier.
    return { status: 'expired' as const, error: invalid };
  }
}
