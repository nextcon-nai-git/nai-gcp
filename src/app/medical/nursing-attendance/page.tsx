"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NursingAttendanceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/medical/health-management");
  }, [router]);

  return null;
}
