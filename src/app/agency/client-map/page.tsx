"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirecionamento de segurança para módulo desativado (Mapa de Unidades).
 */
export default function ClientMapRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
