import { NextResponse } from "next/server";

export class AuthError extends Error {
  constructor(
    public message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export function unauthorized(
  message = "Autenticação necessária: credencial inválida ou ausente."
): AuthError {
  return new AuthError(message, 401);
}

export function forbidden(
  message = "Acesso proibido: permissão insuficiente ou tenant não autorizado."
): AuthError {
  return new AuthError(message, 403);
}

export function badRequest(message = "Requisição inválida."): AuthError {
  return new AuthError(message, 400);
}

export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const msg = error instanceof Error ? error.message : "Erro interno de autenticação/autorização.";
  return NextResponse.json({ error: msg }, { status: 500 });
}
