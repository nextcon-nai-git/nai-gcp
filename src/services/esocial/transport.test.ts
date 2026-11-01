// @vitest-environment node
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import type { RequestOptions } from "node:https";
import type { IncomingMessage } from "node:http";
import { PassThrough } from "node:stream";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  XmlBufferInputProvider,
  XmlDocument,
  XmlElement,
  XsdValidator,
  xmlCleanupInputProvider,
  xmlRegisterInputProvider,
} from "libxml2-wasm";
import {
  inspectPkcs12,
  signEsocialXml,
  verifyEsocialXmlSignature,
  type CertificateMaterial,
} from "./certificate";
import {
  ESOCIAL_COMMUNICATION,
  ESOCIAL_ENDPOINTS,
  buildEsocialBatchEnvelope,
  buildEsocialQueryEnvelope,
  parseEsocialQueryResponse,
  parseEsocialSubmissionResponse,
  queryEsocialBatch,
  sendEsocialBatch,
  type QueryEsocialBatchInput,
  type SendEsocialBatchInput,
} from "./transport";
import {
  makeSyntheticA1,
  SYNTHETIC_CNPJ,
  SYNTHETIC_EVENT_ID,
  SYNTHETIC_PASSWORD,
  SYNTHETIC_PROTOCOL,
  syntheticUnsignedXml,
} from "./certificate.test-fixtures";

const https = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request: https.request }));

const fixtures = "tests/fixtures/esocial/communication-v1.6/";
const submission = readFileSync(`${fixtures}submission-accepted.xml`, "utf8");
const completedFixture = readFileSync(`${fixtures}batch-completed-accepted.xml`, "utf8");
let completed: string;
const rejected = readFileSync(`${fixtures}batch-completed-rejected.xml`, "utf8");
const processing = readFileSync(`${fixtures}batch-processing.xml`, "utf8");
let material: CertificateMaterial;
let sendInput: SendEsocialBatchInput;
let queryInput: QueryEsocialBatchInput;

beforeAll(async () => {
  material = await inspectPkcs12(makeSyntheticA1().pfx, SYNTHETIC_PASSWORD);
  sendInput = {
    environment: "restricted",
    signedXml: signEsocialXml(syntheticUnsignedXml(), material),
    eventId: SYNTHETIC_EVENT_ID,
    employer: { type: "1", number: SYNTHETIC_CNPJ },
    transmitter: { type: "1", number: SYNTHETIC_CNPJ },
    certificate: material,
  };
  queryInput = {
    environment: "restricted",
    protocol: SYNTHETIC_PROTOCOL,
    eventId: SYNTHETIC_EVENT_ID,
    employer: sendInput.employer,
    expectedDigest: verifyEsocialXmlSignature(sendInput.signedXml, material.certificatePem)
      .digestValue,
    certificate: material,
  };
  completed = completedFixture.replace("c3ludGhldGljLWV2ZW50LWhhc2g=", queryInput.expectedDigest);
  xmlRegisterInputProvider(
    new XmlBufferInputProvider({
      "xmldsig-core-schema.xsd": readFileSync(`${fixtures}xmldsig-core-schema.xsd`),
    })
  );
});
afterAll(() => xmlCleanupInputProvider());
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  https.request.mockReset();
  vi.useRealTimers();
  vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "true");
});

function validateSchema(xml: string, schemaPath: string, namespace: string) {
  const schema = XmlDocument.fromString(readFileSync(schemaPath, "utf8"));
  const doc = XmlDocument.fromString(xml);
  const validator = XsdValidator.fromDoc(schema);
  try {
    const element = doc.get("//es:eSocial", { es: namespace });
    expect(element).toBeInstanceOf(XmlElement);
    validator.validate(element as XmlElement);
  } finally {
    validator.dispose();
    doc.dispose();
    schema.dispose();
  }
}

function mockNetwork(
  body: string,
  options: {
    status?: number;
    error?: boolean;
    hang?: boolean;
    encoding?: string;
    abort?: boolean;
  } = {}
) {
  const captured: { url?: URL; options?: RequestOptions; body?: Buffer; destroyed?: boolean } = {};
  https.request.mockImplementation(
    (url: URL, requestOptions: RequestOptions, callback: (response: IncomingMessage) => void) => {
      captured.url = url;
      captured.options = requestOptions;
      const request = Object.assign(new EventEmitter(), {
        destroy: () => {
          captured.destroyed = true;
        },
        end: (bytes: Buffer) => {
          captured.body = bytes;
          if (options.hang) return;
          queueMicrotask(() => {
            if (options.error) {
              request.emit("error", new Error("PRIVATE-ERROR-MUST-NOT-LEAK"));
              return;
            }
            const response = Object.assign(new PassThrough(), {
              statusCode: options.status ?? 200,
              headers: options.encoding ? { "content-encoding": options.encoding } : {},
            });
            callback(response as unknown as IncomingMessage);
            if (options.abort) {
              response.emit("aborted");
              response.destroy();
              return;
            }
            response.end(Buffer.from(body));
          });
        },
      });
      return request;
    }
  );
  return captured;
}

describe("official eSocial 1.6/1.6-Alfa SOAP contract", () => {
  it("builds a unitary signed group-2 envelope valid under the official submission XSD", () => {
    const xml = buildEsocialBatchEnvelope(sendInput);
    expect(xml).toContain('envioLoteEventos grupo="2"');
    expect(xml).toContain('<EnviarLoteEventos xmlns="' + ESOCIAL_COMMUNICATION.sendService + '">');
    expect(xml).toContain(sendInput.signedXml.replace(/^<\?xml[^?]*\?>\s*/, ""));
    validateSchema(xml, `${fixtures}EnvioLoteEventos-v1_1_1.xsd`, ESOCIAL_COMMUNICATION.send);
  });
  it("supports an alphanumeric employer with the unmodified official 1.6-Alfa schema", () => {
    const employer = { type: "1" as const, number: "12ABC34501DE35" };
    const xml = syntheticUnsignedXml().replaceAll(SYNTHETIC_CNPJ, employer.number);
    const input = {
      ...sendInput,
      employer,
      eventId: SYNTHETIC_EVENT_ID.replace(SYNTHETIC_CNPJ, employer.number),
      signedXml: signEsocialXml(xml, material),
    };
    validateSchema(
      buildEsocialBatchEnvelope(input),
      "tests/fixtures/esocial/communication-v1.6-alfa/EnvioLoteEventos-v1_1_1.xsd",
      ESOCIAL_COMMUNICATION.send
    );
  });
  it("builds a query valid under the official consultation schema", () => {
    validateSchema(
      buildEsocialQueryEnvelope(queryInput),
      `${fixtures}ConsultaLoteEventos-v1_0_0.xsd`,
      ESOCIAL_COMMUNICATION.query
    );
  });
  it.each([
    [submission, "RetornoEnvioLoteEventos-v1_1_0.xsd", ESOCIAL_COMMUNICATION.sendResult],
    [processing, "RetornoProcessamentoLote-v1_3_0.xsd", ESOCIAL_COMMUNICATION.queryResult],
    [completedFixture, "RetornoProcessamentoLote-v1_3_0.xsd", ESOCIAL_COMMUNICATION.queryResult],
    [rejected, "RetornoProcessamentoLote-v1_3_0.xsd", ESOCIAL_COMMUNICATION.queryResult],
    [completedFixture, "RetornoEvento-v1_3_0.xsd", ESOCIAL_COMMUNICATION.eventResult],
    [rejected, "RetornoEvento-v1_3_0.xsd", ESOCIAL_COMMUNICATION.eventResult],
  ])("validates a synthetic SOAP fixture against %s", (xml, schema, namespace) => {
    validateSchema(xml, `${fixtures}${schema}`, namespace);
  });
  it("refuses environment, employer, transmitter and event-ID divergence before network", async () => {
    await expect(sendEsocialBatch({ ...sendInput, environment: "production" })).rejects.toThrow(
      "divergem"
    );
    await expect(
      sendEsocialBatch({ ...sendInput, eventId: SYNTHETIC_EVENT_ID.replace(/1$/, "2") })
    ).rejects.toThrow("divergem");
    await expect(
      sendEsocialBatch({ ...sendInput, employer: { type: "1", number: "11222333" } })
    ).rejects.toThrow("divergem");
    await expect(
      sendEsocialBatch({ ...sendInput, transmitter: { type: "2", number: "12345678909" } })
    ).rejects.toThrow("transmissor");
    expect(https.request).not.toHaveBeenCalled();
  });
});

describe("batch protocol is separate from event acceptance", () => {
  it("keeps batch reception and duplicate-batch 203 separate from a receipt", () => {
    const first = parseEsocialSubmissionResponse(submission, sendInput);
    expect(first).toMatchObject({
      status: "accepted",
      protocol: SYNTHETIC_PROTOCOL,
      code: "201",
      duplicateBatch: false,
    });
    expect(first).not.toHaveProperty("receipt");
    expect(
      parseEsocialSubmissionResponse(
        submission.replace("<cdResposta>201", "<cdResposta>203"),
        sendInput
      )
    ).toMatchObject({ status: "accepted", duplicateBatch: true });
  });
  it("requires a valid protocol even for 203 and correlates employer/transmitter", () => {
    expect(() =>
      parseEsocialSubmissionResponse(
        submission
          .replace(/<dadosRecepcaoLote>.*<\/dadosRecepcaoLote>/, "")
          .replace("<cdResposta>201", "<cdResposta>203"),
        sendInput
      )
    ).toThrow();
    expect(() =>
      parseEsocialSubmissionResponse(
        submission.replaceAll(SYNTHETIC_CNPJ, "12345678000195"),
        sendInput
      )
    ).toThrow("outro empregador");
  });
  it("preserves uncertain server errors and definitive batch rejection", () => {
    expect(
      parseEsocialSubmissionResponse(
        submission.replace("<cdResposta>201", "<cdResposta>301"),
        sendInput
      ).status
    ).toBe("uncertain");
    expect(
      parseEsocialSubmissionResponse(
        submission.replace("<cdResposta>201", "<cdResposta>407"),
        sendInput
      ).status
    ).toBe("rejected");
  });
  it("returns processing with the government recommended consultation delay", () => {
    expect(parseEsocialQueryResponse(processing, queryInput)).toMatchObject({
      status: "processing",
      code: "101",
      estimatedSeconds: 30,
      events: [],
    });
  });
  it("maps accepted events only when the matching ID and original receipt are present", () => {
    expect(parseEsocialQueryResponse(completed, queryInput)).toMatchObject({
      status: "completed",
      events: [
        {
          eventId: SYNTHETIC_EVENT_ID,
          status: "accepted",
          receipt: "1.2.0000000000000000001",
          code: "201",
        },
      ],
    });
    const duplicate = completed.replace(
      `<evento Id="${SYNTHETIC_EVENT_ID}">`,
      `<evento Id="${SYNTHETIC_EVENT_ID}" evtDupl="true">`
    );
    expect(parseEsocialQueryResponse(duplicate, queryInput).events[0].status).toBe("duplicate");
    expect(() =>
      parseEsocialQueryResponse(duplicate.replace(/<recibo>.*<\/recibo>/, ""), queryInput)
    ).toThrow();
  });
  it("keeps a duplicate error without a receipt rejected even when the batch completed", () => {
    const result = parseEsocialQueryResponse(rejected, queryInput);
    expect(result.status).toBe("completed");
    expect(result.events[0]).toMatchObject({
      status: "rejected",
      code: "401",
      issues: [{ code: "106", type: "error" }],
    });
    expect(result.events[0]).not.toHaveProperty("receipt");
  });
  it("rejects a different signed-content hash even with matching ID, employer and a duplicate receipt", () => {
    const duplicate = completed.replace(
      `<evento Id="${SYNTHETIC_EVENT_ID}">`,
      `<evento Id="${SYNTHETIC_EVENT_ID}" evtDupl="true">`
    );
    expect(() =>
      parseEsocialQueryResponse(
        duplicate.replace(queryInput.expectedDigest, "A".repeat(43) + "="),
        queryInput
      )
    ).toThrow("hash do recibo");
    expect(() =>
      parseEsocialQueryResponse(
        completed.replace(queryInput.expectedDigest, "A".repeat(43) + "="),
        queryInput
      )
    ).toThrow("hash do recibo");
  });
  it("preserves an event validation-history occurrence (type 3) without treating it as rejection", () => {
    const history =
      "<ocorrencias><ocorrencia><tipo>3</tipo><codigo>999</codigo><descricao>Histórico de validação sintético.</descricao></ocorrencia></ocorrencias>";
    const raw = completed.replace(
      "</dhProcessamento></processamento>",
      `</dhProcessamento>${history}</processamento>`
    );
    expect(parseEsocialQueryResponse(raw, queryInput).events[0]).toMatchObject({
      status: "accepted",
      issues: [{ type: "history", code: "999" }],
    });
  });
  it("refuses mismatched outer/inner event IDs, protocol, environment and employer", () => {
    expect(() =>
      parseEsocialQueryResponse(
        completed.replace(
          `<retornoEvento Id="${SYNTHETIC_EVENT_ID}">`,
          `<retornoEvento Id="${SYNTHETIC_EVENT_ID.replace(/1$/, "2")}">`
        ),
        queryInput
      )
    ).toThrow("divergem");
    expect(() =>
      parseEsocialQueryResponse(
        completed.replaceAll(SYNTHETIC_PROTOCOL, "1.2.202610.0000000000000000002"),
        queryInput
      )
    ).toThrow("outro protocolo");
    expect(() =>
      parseEsocialQueryResponse(completed.replace("<tpAmb>2", "<tpAmb>1"), queryInput)
    ).toThrow("outro ambiente");
    expect(() =>
      parseEsocialQueryResponse(completed.replaceAll(SYNTHETIC_CNPJ, "12345678000195"), queryInput)
    ).toThrow();
  });
  it("keeps consultation error separate from event rejection and throws transient query errors", () => {
    const error = processing.replace("<cdResposta>101", "<cdResposta>501");
    expect(parseEsocialQueryResponse(error, queryInput)).toMatchObject({
      status: "rejected",
      rejectionScope: "query",
      events: [],
    });
    expect(() =>
      parseEsocialQueryResponse(
        processing.replace("<cdResposta>101", "<cdResposta>301"),
        queryInput
      )
    ).toThrow("erro temporário");
  });
  it("rejects SOAP 1.2, unrelated namespaces, duplicate bodies, DTD and faults", () => {
    expect(() =>
      parseEsocialSubmissionResponse(
        submission.replaceAll(
          ESOCIAL_COMMUNICATION.soap,
          "http://www.w3.org/2003/05/soap-envelope"
        ),
        sendInput
      )
    ).toThrow();
    expect(() =>
      parseEsocialSubmissionResponse(
        submission.replaceAll(ESOCIAL_COMMUNICATION.sendResult, "urn:untrusted"),
        sendInput
      )
    ).toThrow();
    expect(() =>
      parseEsocialSubmissionResponse(
        submission.replace("</soap:Envelope>", "<soap:Body/></soap:Envelope>"),
        sendInput
      )
    ).toThrow();
    expect(() =>
      parseEsocialSubmissionResponse(
        submission.replace(
          "<soap:Envelope",
          '<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><soap:Envelope'
        ),
        sendInput
      )
    ).toThrow();
    expect(() =>
      parseEsocialSubmissionResponse(
        `<soap:Envelope xmlns:soap="${ESOCIAL_COMMUNICATION.soap}"><soap:Body><soap:Fault><faultcode>soap:Server</faultcode></soap:Fault></soap:Body></soap:Envelope>`,
        sendInput
      )
    ).toThrow("falha SOAP");
  });
});

describe("bounded HTTPS mTLS with no real network or automatic retries", () => {
  it.each([undefined, "false", "TRUE"])(
    "blocks submission at the network boundary when configuration is %s",
    async (value) => {
      vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", value);
      await expect(sendEsocialBatch(sendInput)).rejects.toMatchObject({
        code: "TRANSMISSION_DISABLED",
        submissionUncertain: false,
      });
      expect(https.request).not.toHaveBeenCalled();
    }
  );
  it("allows a protocol query while new transmissions are disabled", async () => {
    vi.stubEnv("ESOCIAL_TRANSMISSION_ENABLED", "false");
    mockNetwork(processing);
    expect((await queryEsocialBatch(queryInput)).status).toBe("processing");
    expect(https.request).toHaveBeenCalledTimes(1);
  });
  it("uses the fixed restricted endpoint, required SOAPAction and peer-verified mTLS", async () => {
    const request = mockNetwork(submission);
    expect((await sendEsocialBatch(sendInput)).status).toBe("accepted");
    expect(request.url?.href).toBe(ESOCIAL_ENDPOINTS.restricted.send);
    expect(request.options).toMatchObject({
      method: "POST",
      agent: false,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      key: material.privateKeyPem,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${ESOCIAL_COMMUNICATION.sendService}/ServicoEnviarLoteEventos/EnviarLoteEventos"`,
      },
    });
    expect(request.options).not.toHaveProperty("ca");
    expect(request.options?.headers).toHaveProperty("Content-Length", request.body!.length);
    expect(https.request).toHaveBeenCalledTimes(1);
  });
  it("uses the separate production consultation endpoint and query SOAPAction", async () => {
    const request = mockNetwork(
      completed
        .replaceAll(SYNTHETIC_PROTOCOL, "1.1.202610.0000000000000000001")
        .replace("<tpAmb>2", "<tpAmb>1")
        .replace("<nrRecibo>1.2.", "<nrRecibo>1.1.")
    );
    const result = await queryEsocialBatch({
      ...queryInput,
      environment: "production",
      protocol: "1.1.202610.0000000000000000001",
    });
    expect(result.events[0].status).toBe("accepted");
    expect(request.url?.href).toBe(ESOCIAL_ENDPOINTS.production.query);
    expect(request.options?.headers).toHaveProperty(
      "SOAPAction",
      `"${ESOCIAL_COMMUNICATION.queryService}/ServicoConsultarLoteEventos/ConsultarLoteEventos"`
    );
  });
  it.each([302, 307, 500, 503])("does not redirect or retry HTTP %s", async (status) => {
    mockNetwork("response unavailable", { status });
    expect(await sendEsocialBatch(sendInput)).toMatchObject({
      status: "uncertain",
      code: `HTTP_${status}`,
    });
    expect(https.request).toHaveBeenCalledTimes(1);
  });
  it("sanitizes transport exceptions, including synchronous TLS failures", async () => {
    mockNetwork("", { error: true });
    const response = await sendEsocialBatch(sendInput);
    expect(response).toMatchObject({ status: "uncertain", code: "TRANSPORT_ERROR" });
    expect(JSON.stringify(response)).not.toContain("PRIVATE-ERROR");
    https.request.mockImplementation(() => {
      throw new Error("private TLS detail");
    });
    expect(await sendEsocialBatch(sendInput)).toMatchObject({
      status: "uncertain",
      code: "TRANSPORT_ERROR",
    });
  });
  it("has an absolute 30-second deadline without retrying the POST", async () => {
    vi.useFakeTimers();
    const request = mockNetwork("", { hang: true });
    const pending = sendEsocialBatch(sendInput);
    await vi.advanceTimersByTimeAsync(30_001);
    expect(await pending).toMatchObject({ status: "uncertain", code: "TRANSPORT_TIMEOUT" });
    expect(request.destroyed).toBe(true);
    expect(https.request).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
  it("bounds response bytes and rejects compressed, truncated or unverifiable responses", async () => {
    mockNetwork("x".repeat(2 * 1024 * 1024 + 1));
    expect(await sendEsocialBatch(sendInput)).toMatchObject({
      status: "uncertain",
      code: "RESPONSE_SIZE",
    });
    mockNetwork("gzip", { encoding: "gzip" });
    expect(await sendEsocialBatch(sendInput)).toMatchObject({
      status: "uncertain",
      code: "RESPONSE_ENCODING",
    });
    mockNetwork("", { abort: true });
    expect(await sendEsocialBatch(sendInput)).toMatchObject({
      status: "uncertain",
      code: "TRANSPORT_ERROR",
    });
    mockNetwork("<invalid-response/>");
    expect((await sendEsocialBatch(sendInput)).status).toBe("uncertain");
  });
  it("throws a consultation transport failure so the existing submission stays pending", async () => {
    mockNetwork("", { error: true });
    await expect(queryEsocialBatch(queryInput)).rejects.toMatchObject({
      code: "TRANSPORT_ERROR",
      submissionUncertain: false,
    });
    expect(https.request).toHaveBeenCalledTimes(1);
  });
});

