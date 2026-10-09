import { expect, it } from "vitest";
import { validateWebhookTargetUrl, isPrivateOrReservedIp } from "./webhook-security-guard";
it.each(["https://user:password@8.8.8.8/", "https://8.8.8.8/#secret"])(
  "rejects credential/fragment URL %s",
  async (url) => {
    expect((await validateWebhookTargetUrl(url)).valid).toBe(false);
  }
);
it.each([
  "127.1.2.3",
  "169.254.169.254",
  "::ffff:127.0.0.1",
  "fc00::1",
  "100.64.0.1",
  "203.0.113.1",
])("blocks private/reserved IP %s", (ip) => {
  expect(isPrivateOrReservedIp(ip)).toBe(true);
});
