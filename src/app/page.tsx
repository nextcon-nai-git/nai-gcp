"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc } from "firebase/firestore";
import { useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard";

export default function DashboardPage() {
  const { user, role } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const profileRef = useMemoFirebase(
    () => (db && user ? doc(db, "users", user.uid) : null),
    [db, user]
  );
  const { data: profile } = useDoc(profileRef);
  const provider = (profile?.role || role || "").toUpperCase() === "PROVIDER";
  const type = String(profile?.type || profile?.providerType || "").toUpperCase();
  const specialty = String(
    profile?.specialty || profile?.profession || profile?.job_role || ""
  ).toUpperCase();
  const engineering =
    type.includes("ENGINEER") ||
    ["SEGURANÇA", "ENGENHARIA", "TST", "TÉCNICO"].some((value) => specialty.includes(value));
  useEffect(() => {
    if (provider && profile) router.replace(engineering ? "/risk-management" : "/health-control");
  }, [provider, profile, engineering, router]);
  if (provider)
    return (
      <p role="status" className="p-8 text-sm text-slate-500">
        Abrindo seu módulo operacional…
      </p>
    );
  return <ExecutiveDashboardView />;
}
