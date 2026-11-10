import { notFound } from "next/navigation";
import { SstAnalysisForm } from "@/components/sst/analysis-form";
import { getSstModule, type SstModule } from "@/lib/genkit/sst-modules";
export default async function AnalysisPage({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  if (!getSstModule(modulo)) notFound();
  return <SstAnalysisForm moduleId={modulo as SstModule} />;
}
