"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * @fileOverview Módulo de Importação Legado - Desativado em favor do data-import unificado.
 * Redireciona para o novo Hub de Carga de Dados para evitar redundâncias.
 */
export default function LegacyImportRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/data-import");
  }, [router]);

  return null;
}
