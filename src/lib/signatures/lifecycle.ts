import { createHash } from "node:crypto";
import { z } from "zod";

const id = z.string().trim().min(1).max(180);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const instant = z.string().datetime();
const status = z.enum([
  "draft",
  "approved",
  "submitted",
  "partially_signed",
  "provider_completed",
  "cancelled",
  "expired",
]);
const binding = z.object({
  tenantId: id,
  recordId: id,
  documentVersion: z.number().int().positive(),
  sourceSha256: hash,
});
export const SignatureRequestSchema = binding
  .extend({
    id,
    status,
    approval: z.object({ actorId: id, at: instant }).strict().nullable(),
    submission: z
      .object({ provider: id, envelopeId: id, environment: z.enum(["sandbox", "production"]) })
      .strict()
      .nullable(),
    events: z.array(z.object({ id, fingerprint: hash }).strict()).max(500),
    finalArtifact: z.object({ sha256: hash, evidenceReference: id }).strict().nullable(),
  })
  .strict()
  .superRefine((request, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
    if ((request.status === "draft") !== (request.approval === null))
      invalid("A aprovação deve corresponder ao estado da solicitação.");
    if (["draft", "approved"].includes(request.status) === Boolean(request.submission))
      invalid("A referência do provedor deve corresponder ao estado da solicitação.");
    if ((request.status === "provider_completed") !== Boolean(request.finalArtifact))
      invalid("A conclusão do provedor exige documento final e referência das evidências.");
    if (new Set(request.events.map((event) => event.id)).size !== request.events.length)
      invalid("Eventos repetidos na solicitação.");
    if (!request.submission && request.events.length) invalid("Eventos exigem envio ao provedor.");
  });
export type SignatureRequest = z.infer<typeof SignatureRequestSchema>;

export function prepareSignature(
  input: z.infer<typeof binding> & { id: string }
): SignatureRequest {
  return SignatureRequestSchema.parse({
    ...input,
    status: "draft",
    approval: null,
    submission: null,
    events: [],
    finalArtifact: null,
  });
}

/** Caller must authenticate and authorize this actor against the tenant on the server. */
export function approveSignature(input: SignatureRequest, actorId: string, at: string) {
  const request = SignatureRequestSchema.parse(input);
  if (request.status !== "draft") throw new Error("Somente rascunhos podem ser aprovados.");
  return SignatureRequestSchema.parse({
    ...request,
    status: "approved",
    approval: { actorId, at },
  });
}

/** Records a confirmed provider response; does not send a document or authorize an API call. */
export function recordSignatureSubmission(
  input: SignatureRequest,
  currentDocument: z.infer<typeof binding>,
  submission: NonNullable<SignatureRequest["submission"]>
) {
  const request = SignatureRequestSchema.parse(input);
  const current = binding.strict().parse(currentDocument);
  if (request.status !== "approved") throw new Error("Aprovação necessária antes do envio.");
  if (
    request.tenantId !== current.tenantId ||
    request.recordId !== current.recordId ||
    request.documentVersion !== current.documentVersion ||
    request.sourceSha256 !== current.sourceSha256
  )
    throw new Error(
      "O documento foi alterado ou pertence a outro registro. Prepare nova solicitação."
    );
  return SignatureRequestSchema.parse({ ...request, status: "submitted", submission });
}

export const SignatureEventSchema = binding
  .extend({
    id,
    requestId: id,
    provider: id,
    envelopeId: id,
    environment: z.enum(["sandbox", "production"]),
    status: z.enum(["partially_signed", "provider_completed", "cancelled", "expired"]),
    finalArtifact: z.object({ sha256: hash, evidenceReference: id }).strict().nullable(),
  })
  .strict()
  .refine(
    (event) => (event.status === "provider_completed") === Boolean(event.finalArtifact),
    "Documento final e evidências são exigidos apenas na conclusão do provedor."
  );

/** Internal reducer only. A future adapter must verify webhook authenticity, resolve bindings
 * from trusted storage, fetch final evidence and persist this update atomically before use.
 * Provider completion is NOT certificate validation or professional approval.
 */
export function applySignatureEvent(input: SignatureRequest, rawEvent: unknown): SignatureRequest {
  const request = SignatureRequestSchema.parse(input);
  const event = SignatureEventSchema.parse(rawEvent);
  if (
    !request.submission ||
    event.requestId !== request.id ||
    event.tenantId !== request.tenantId ||
    event.recordId !== request.recordId ||
    event.documentVersion !== request.documentVersion ||
    event.sourceSha256 !== request.sourceSha256 ||
    event.provider !== request.submission.provider ||
    event.envelopeId !== request.submission.envelopeId ||
    event.environment !== request.submission.environment
  )
    throw new Error("Evento não corresponde ao documento, organização ou envio.");
  const fingerprint = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  const previous = request.events.find((item) => item.id === event.id);
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw new Error("Evento repetido com conteúdo distinto.");
    return request;
  }
  if (["provider_completed", "cancelled", "expired"].includes(request.status))
    throw new Error("Evento tardio não pode alterar uma solicitação encerrada.");
  if (request.events.length >= 500)
    throw new Error("Limite de eventos atingido; revisão necessária.");
  return SignatureRequestSchema.parse({
    ...request,
    status: event.status,
    finalArtifact: event.finalArtifact,
    events: [...request.events, { id: event.id, fingerprint }],
  });
}
