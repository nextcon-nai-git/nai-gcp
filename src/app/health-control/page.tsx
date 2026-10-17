import { AsoWorkspace } from "@/components/aso/aso-workspace";
import { asoWorkspaceView, type AsoSearchParams } from "@/lib/aso-workspace-navigation";

export default async function HealthControlPage({
  searchParams,
}: {
  searchParams: Promise<AsoSearchParams>;
}) {
  const params = await searchParams;
  return <AsoWorkspace view={asoWorkspaceView(params)} searchParams={params} />;
}
