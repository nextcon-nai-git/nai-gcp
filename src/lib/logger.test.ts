// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("emits structured JSON with severity", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("boom", { code: 1 });
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({ severity: "ERROR", message: "boom", code: 1 });
  });

  it("protects the severity, message and timestamp from context overrides", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T15:00:00.000Z"));
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("Original warning", {
      severity: "INFO",
      message: "overwritten",
      timestamp: "invalid",
      requestId: "synthetic-request",
    });
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({
      severity: "WARNING",
      message: "Original warning",
      timestamp: "2026-10-03T15:00:00.000Z",
      requestId: "synthetic-request",
    });
  });

  it("does not let a context serialization hook replace the log record", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Original error", {
      toJSON: () => ({ severity: "INFO", message: "overwritten" }),
      code: "synthetic-code",
    });
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toMatchObject({
      severity: "ERROR",
      message: "Original error",
      code: "synthetic-code",
    });
  });

  it("handles circular context, big integers and Errors without losing shared references", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const shared = { count: BigInt("9007199254740993") };
    const context: Record<string, unknown> = { first: shared, second: shared };
    context.self = context;
    context.error = new TypeError("synthetic failure");
    expect(() => logger.error("Recovery", context)).not.toThrow();
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toMatchObject({
      first: { count: "9007199254740993" },
      second: { count: "9007199254740993" },
      self: { self: "[Circular]" },
      error: { name: "TypeError", message: "synthetic failure" },
    });
  });

  it("redacts known authentication fields in nested context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("Authentication failed", {
      authorization: "Bearer synthetic-secret",
      request: { access_token: "synthetic-token", password: "synthetic-password", code: 401 },
    });
    const output = spy.mock.calls[0][0] as string;
    expect(output).not.toContain("synthetic-secret");
    expect(output).not.toContain("synthetic-token");
    expect(output).not.toContain("synthetic-password");
    expect(JSON.parse(output).request).toEqual({
      access_token: "[REDACTED]",
      password: "[REDACTED]",
      code: 401,
    });
  });

  it("keeps a valid diagnostic record when custom serialization throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      logger.error("Screen failed", {
        provider: {
          toJSON() {
            throw new Error("synthetic-sensitive-detail");
          },
        },
      })
    ).not.toThrow();
    const output = spy.mock.calls[0][0] as string;
    expect(JSON.parse(output)).toMatchObject({
      severity: "ERROR",
      message: "Screen failed",
      contextSerializationFailed: true,
    });
    expect(output).not.toContain("synthetic-sensitive-detail");
  });
});
