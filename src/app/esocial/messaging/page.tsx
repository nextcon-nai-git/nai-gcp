import EsocialMessagingWorkspace from "@/components/esocial/messaging-workspace";

export default async function MessagingPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string | string[]; aso?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <EsocialMessagingWorkspace
      initialCompany={typeof params.company === "string" ? params.company : ""}
      initialAso={typeof params.aso === "string" ? params.aso : ""}
    />
  );
}
