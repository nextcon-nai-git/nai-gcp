"use client";

export type MessagingApi = {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  download: (path: string, fileName: string) => Promise<void>;
};

export function jsonRequest(value: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a ação.";
}

export function displayDate(value?: string) {
  if (!value) return "Não informada";
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString("pt-BR") : value;
}
