"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirecionamento de segurança: O Agente NAI (antigo Butler) agora faz parte do Centro de Operação Next.
 */
export default function ButlerRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/action-plans");
  }, [router]);

  return null;
}
