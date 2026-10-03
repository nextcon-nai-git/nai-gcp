"use client";

/**
 * Ponto de entrada unificado para o motor Firebase.
 * Exporta hooks, providers e serviços inicializados.
 */

export * from "./init";
export * from "./provider";
export * from "./client-provider";
export * from "./firestore/use-collection";
export * from "./firestore/use-collection-deduped";
export * from "./firestore/use-doc";
export * from "./non-blocking-updates";
export * from "./non-blocking-login";
export * from "./errors";
export * from "./error-emitter";
