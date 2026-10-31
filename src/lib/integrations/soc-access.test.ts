import { describe, expect, it } from "vitest";
import { socWebAccess } from "./soc-access";

describe("SOC web access configuration", () => {
  const valid = {
    SOC_SSO_LAUNCH_URL: "https://idp.example.com/saml/soc?app=nai",
    SOC_SSO_ALLOWED_ORIGIN: "https://idp.example.com",
  };
  it("keeps ordinary login explicit when SSO was not provisioned", () => {
    expect(socWebAccess({})).toEqual({
      mode: "login",
      href: "https://sistema.soc.com.br/WebSoc/",
    });
  });
  it("accepts an explicitly approved HTTPS launch origin without claiming authentication", () => {
    expect(socWebAccess(valid)).toEqual({ mode: "sso", href: valid.SOC_SSO_LAUNCH_URL });
  });
  it.each([
    "http://idp.example.com/saml/soc",
    "https://other.example.com/saml/soc",
    "https://idp.example.com.evil.example/saml/soc",
    "https://user:password@idp.example.com/saml/soc",
    "https://idp.example.com/saml/soc#private",
    "https://idp.example.com/saml/soc?password=synthetic",
    "https://idp.example.com/saml/soc?%74oken=synthetic",
    "https://idp.example.com/saml/soc?SAMLResponse=synthetic",
    "https://idp.example.com/saml/soc?RelayState=synthetic",
    "javascript:alert(1)",
  ])("does not expose an unsafe or session-bound URL: %s", (url) => {
    expect(socWebAccess({ ...valid, SOC_SSO_LAUNCH_URL: url })).toEqual({
      mode: "invalid",
      href: null,
    });
  });
  it.each([
    { SOC_SSO_LAUNCH_URL: valid.SOC_SSO_LAUNCH_URL },
    { SOC_SSO_ALLOWED_ORIGIN: valid.SOC_SSO_ALLOWED_ORIGIN },
    { ...valid, SOC_SSO_ALLOWED_ORIGIN: "https://idp.example.com/path" },
    { ...valid, SOC_SSO_ALLOWED_ORIGIN: "https://idp.example.com?token=synthetic" },
    { ...valid, SOC_SSO_ALLOWED_ORIGIN: "invalid" },
  ])("rejects incomplete or invalid origin configuration", (env) => {
    expect(socWebAccess(env)).toEqual({ mode: "invalid", href: null });
  });
});
