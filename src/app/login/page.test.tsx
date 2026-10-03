import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({ auth: {}, signIn: vi.fn(), replace: vi.fn(), toast: vi.fn() }));
vi.mock("@/firebase", () => ({ useAuth: () => mocks.auth }));
vi.mock("firebase/auth", () => ({ signInWithEmailAndPassword: mocks.signIn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

let element: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/login");
  mocks.signIn.mockResolvedValue({});
  element = document.createElement("div");
  document.body.appendChild(element);
  root = createRoot(element);
  await act(async () => root.render(<LoginPage />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});

async function fillCredentials() {
  await act(async () => {
    for (const [id, value] of [
      ["login-email", "Person@Example.test"],
      ["login-password", "synthetic-password"],
    ]) {
      const input = element.querySelector<HTMLInputElement>(`#${id}`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}
async function submit() {
  await act(async () => {
    element
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("password login", () => {
  it("offers only the labeled email/password form and does not sign in automatically", () => {
    expect(element.querySelectorAll("form")).toHaveLength(1);
    expect(element.querySelectorAll("input")).toHaveLength(2);
    expect(element.querySelectorAll("button")).toHaveLength(1);
    expect(element.querySelector('label[for="login-email"]')).not.toBeNull();
    expect(element.querySelector('label[for="login-password"]')).not.toBeNull();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("normalizes the email and always enters the home page after authentication", async () => {
    window.history.replaceState(null, "", "/login?returnTo=https%3A%2F%2Fexample.test");
    await fillCredentials();
    await submit();
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith(
      mocks.auth,
      "person@example.test",
      "synthetic-password"
    );
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("blocks repeated submission until the current sign-in completes", async () => {
    let finish!: () => void;
    mocks.signIn.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    await fillCredentials();
    await submit();
    expect(element.querySelector("button")?.disabled).toBe(true);
    expect([...element.querySelectorAll("input")].every((input) => input.disabled)).toBe(true);
    await submit();
    expect(mocks.signIn).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(mocks.replace).toHaveBeenCalledOnce();
  });

  it("permits retry after a connection error without exposing provider details", async () => {
    mocks.signIn.mockRejectedValueOnce({
      code: "auth/network-request-failed",
      message: "private-provider-detail",
    });
    await fillCredentials();
    await submit();
    expect(element.querySelector("button")?.disabled).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Verifique sua conexão e tente novamente." })
    );
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain("private-provider-detail");
    await submit();
    expect(mocks.signIn).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
  });
});
