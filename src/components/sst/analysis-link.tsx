import Link from "next/link";
import { sstModules, type SstModule } from "@/lib/genkit/sst-modules";
export function SstAnalysisLink({ id }: { id: SstModule }) {
  return (
    <Link
      className="inline-flex rounded-md bg-background px-3 py-2 text-sm font-medium text-primary underline underline-offset-4"
      href={"/analises-sst/" + id}
    >
      {sstModules[id].title}
    </Link>
  );
}
