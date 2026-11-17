import "server-only";
import { unstable_cache } from "next/cache";
import { socConfiguration } from "@/lib/integrations/soc";
import { monitoredSocRead } from "@/lib/integrations/soc-monitor";
import { saoPauloDay, type AvpWorkforce } from "@/lib/executive-dashboard";

// SOC Cadastro de Funcionários (por empresa), ASSOBES. See docs/soc-integration.md.
const companyId = "2306171";
const manualReference: AvpWorkforce = { records: 5685, observedOn: "2026-10-16", source: "manual" };

// Cache only the aggregate. The full response stays inside the authorized server read.
const readRoster = unstable_cache(
  async (): Promise<AvpWorkforce> => {
    const { data, checkedAt } = await monitoredSocRead("employees", { companyId }, "dashboard");
    const ids = new Set(data.map((row) => row.id));
    if (ids.size !== data.length || data.some((row) => !/^\d{1,20}$/.test(row.id)))
      throw new Error("Cadastro SOC com códigos ausentes ou repetidos.");
    return { records: ids.size, observedOn: saoPauloDay(new Date(checkedAt)), source: "connector" };
  },
  ["executive-dashboard", "avp-roster", companyId],
  { revalidate: 3600 }
);

export async function getAvpWorkforce(): Promise<AvpWorkforce> {
  const config = socConfiguration();
  if (!config.companyIds.includes(companyId) || !config.resources.employees.configured)
    return manualReference;
  try {
    return await readRoster();
  } catch {
    return manualReference;
  }
}
