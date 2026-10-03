// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { initializeFirebaseTelemetry, shouldEnableFirebaseTelemetry } from "./telemetry";

describe("Firebase telemetry lifecycle", () => {
  it("never enables cloud telemetry during a production build, even with credentials", () => {
    expect(
      shouldEnableFirebaseTelemetry({
        NEXT_PHASE: "phase-production-build",
        NODE_ENV: "production",
        GOOGLE_APPLICATION_CREDENTIALS: "/synthetic/credentials.json",
      })
    ).toBe(false);
  });

  it("preserves runtime production telemetry and credential-based local telemetry", () => {
    expect(shouldEnableFirebaseTelemetry({ NODE_ENV: "production" })).toBe(true);
    expect(
      shouldEnableFirebaseTelemetry({
        NODE_ENV: "development",
        GOOGLE_APPLICATION_CREDENTIALS: "/synthetic/credentials.json",
      })
    ).toBe(true);
    expect(shouldEnableFirebaseTelemetry({ NODE_ENV: "development" })).toBe(false);
  });

  it("logs success only after initialization resolves", async () => {
    let finish!: () => void;
    const log = { info: vi.fn(), warn: vi.fn() };
    const promise = initializeFirebaseTelemetry(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
      log
    );
    expect(log.info).not.toHaveBeenCalled();
    finish();
    await promise;
    expect(log.info).toHaveBeenCalledOnce();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "contains provider failure without exposing details (sync=%s)",
    async (sync) => {
      const log = { info: vi.fn(), warn: vi.fn() };
      await expect(
        initializeFirebaseTelemetry(() => {
          if (sync) throw new Error("sensitive-provider-detail");
          return Promise.reject(new Error("sensitive-provider-detail"));
        }, log)
      ).resolves.toBeUndefined();
      expect(log.info).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledOnce();
      expect(JSON.stringify(log.warn.mock.calls)).not.toContain("sensitive-provider-detail");
    }
  );
});
