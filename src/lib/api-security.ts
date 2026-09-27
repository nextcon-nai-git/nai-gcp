import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : [];
  return [...new Set([...fromEnv, ...appUrl])];
}

export function resolveCorsHeaders(request: Request, methods: string) {
  const origin = request.headers.get('origin');
  const allowedOrigins = getAllowedOrigins();
  const isAllowedOrigin = !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);

  return {
    isAllowedOrigin,
    headers: {
      'Access-Control-Allow-Origin': origin && isAllowedOrigin ? origin : 'null',
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin',
    },
  };
}

export function rejectIfCorsDenied(request: Request, methods: string): NextResponse | null {
  const cors = resolveCorsHeaders(request, methods);
  if (!cors.isAllowedOrigin) {
    return NextResponse.json(
      { sucesso: false, mensagem: 'Origem não autorizada.' },
      { status: 403, headers: cors.headers }
    );
  }
  return null;
}

export function optionsCorsResponse(request: Request, methods: string): NextResponse {
  const cors = resolveCorsHeaders(request, methods);
  if (!cors.isAllowedOrigin) {
    return new NextResponse(null, { status: 403, headers: cors.headers });
  }
  return new NextResponse(null, { status: 204, headers: cors.headers });
}

export async function requireAuthFromBearer(request: Request): Promise<{ uid: string } | null> {
  const authHeader = request.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(match[1]);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}
