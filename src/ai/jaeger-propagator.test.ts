// @vitest-environment node
import { createRequire } from "node:module";
import {
  ROOT_CONTEXT,
  defaultTextMapGetter,
  defaultTextMapSetter,
  propagation,
  trace,
  type TextMapPropagator,
} from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { afterEach, describe, expect, it } from "vitest";

// Exercise the exact propagator resolved by the older SDK used by Genkit.
const localRequire = createRequire(import.meta.url);
const sdkRequire = createRequire(localRequire.resolve("@opentelemetry/sdk-trace-node"));
const { JaegerPropagator } = sdkRequire("@opentelemetry/propagator-jaeger") as {
  JaegerPropagator: new () => TextMapPropagator;
};

let provider: NodeTracerProvider | undefined;
afterEach(async () => {
  propagation.disable();
  trace.disable();
  await provider?.shutdown();
  provider = undefined;
});

function activateJaeger() {
  provider = new NodeTracerProvider();
  provider.register({ propagator: new JaegerPropagator() });
}

describe("Genkit SDK Jaeger propagation compatibility", () => {
  it.each([{ "uber-trace-id": "%" }, { "uber-trace-id": "%E0%A4%A" }, { "uberctx-user": "%" }])(
    "contains malformed trace and baggage headers: %j",
    (headers) => {
      activateJaeger();
      expect(() => propagation.extract(ROOT_CONTEXT, headers, defaultTextMapGetter)).not.toThrow();
    }
  );

  it("preserves a valid sampled trace across extraction and injection", () => {
    activateJaeger();
    const header = "463ac35c9f6413ad48485a3953bb6124:a2fb4a1d1a96d312:0:01";
    const context = propagation.extract(
      ROOT_CONTEXT,
      { "uber-trace-id": header },
      defaultTextMapGetter
    );
    expect(trace.getSpanContext(context)).toMatchObject({
      traceId: "463ac35c9f6413ad48485a3953bb6124",
      spanId: "a2fb4a1d1a96d312",
      traceFlags: 1,
    });
    const output: Record<string, string> = {};
    propagation.inject(context, output, defaultTextMapSetter);
    expect(output["uber-trace-id"]).toBe(header);
  });
});
