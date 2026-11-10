import { google } from "googleapis";
import { readFileSync } from "node:fs";
const project =
  process.env.GOOGLE_CLOUD_PROJECT ||
  JSON.parse(readFileSync(new URL("../.firebaserc", import.meta.url), "utf8")).projects.default;
const scope = 'jsonPayload.serviceContext.service="nai-gcp-ai-engine"';
const event = (name) => 'jsonPayload.naiMetrics.event="' + name + '"';
const counter = (name, description, kind) => ({
  name,
  description,
  filter: scope + " AND " + event(kind),
  metricDescriptor: { metricKind: "DELTA", valueType: "INT64", unit: "1" },
});
const metrics = [
  counter(
    "nai_ai_fallback_count",
    "Gerações concluídas por um provedor alternativo.",
    "AI_FALLBACK_TRIGGERED"
  ),
  counter(
    "nai_ai_critical_failures_count",
    "Gerações que esgotaram a cadeia de provedores.",
    "AI_ALL_PROVIDERS_FAILED"
  ),
  {
    name: "nai_ai_execution_latency",
    description: "Latência total das gerações concluídas em milissegundos.",
    filter:
      scope +
      " AND (" +
      event("AI_EXECUTION_SUCCESS") +
      " OR " +
      event("AI_FALLBACK_TRIGGERED") +
      ") AND jsonPayload.naiMetrics.latencyMs:*",
    metricDescriptor: { metricKind: "DELTA", valueType: "DISTRIBUTION", unit: "ms" },
    valueExtractor: "EXTRACT(jsonPayload.naiMetrics.latencyMs)",
    bucketOptions: {
      explicitBuckets: { bounds: [100, 250, 500, 1000, 2500, 5000, 10000, 15000, 30000, 60000] },
    },
  },
];
if (process.argv.includes("--dry-run")) console.log(JSON.stringify({ project, metrics }, null, 2));
else {
  const parent = "projects/" + project;
  const logging = google.logging({
    version: "v2",
    auth: new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/logging.admin"] }),
  });
  try {
    for (const metric of metrics) {
      const metricName = parent + "/metrics/" + metric.name;
      try {
        await logging.projects.metrics.get({ metricName });
      } catch (error) {
        if (error.response?.status !== 404) throw error;
        try {
          await logging.projects.metrics.create({ parent, requestBody: metric });
        } catch (createError) {
          if (createError.response?.status !== 409) throw createError;
        }
      }
      await logging.projects.metrics.update({ metricName, requestBody: metric });
      const { data } = await logging.projects.metrics.get({ metricName });
      if (
        data.filter !== metric.filter ||
        data.metricDescriptor?.valueType !== metric.metricDescriptor.valueType
      )
        throw new Error("Configuração divergente.");
      console.log("Métrica verificada: " + metric.name);
    }
  } catch (error) {
    console.error(
      "Falha ao configurar métricas em " +
        project +
        ": " +
        (error.response?.status ||
          (String(error.message).includes("default credentials")
            ? "credencial ADC indisponível"
            : "verifique acesso à API e credenciais."))
    );
    process.exitCode = 1;
  }
}
