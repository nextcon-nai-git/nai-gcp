"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CrmRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/comercial");
  }, [router]);

  return null;
}
