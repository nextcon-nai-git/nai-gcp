"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirecionamento de segurança para módulo desativado.
 */
export default function ClinicHubRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
