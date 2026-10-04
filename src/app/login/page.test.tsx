import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  auth: { languageCode: null as string | null },
  signIn: vi.fn(),
  googleSignIn: vi.fn(),
  googleParameters: vi.fn(),
  sendReset: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/firebase", () => ({ useAuth: () => mocks.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    providerId = "google.com";
    setCustomParameters = mocks.googleParameters;
  },
  signInWithEmailAndPassword: mocks.signIn,
  signInWithPopup: mocks.googleSignIn,
  sendPasswordResetEmail: mocks.sendReset,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

let element: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.history.replaceState(null, "", "/login");
  mocks.signIn.mockResolvedValue({});
  mocks.googleSignIn.mockResolvedValue({});
  mocks.sendReset.mockResolvedValue(undefined);
  mocks.auth.languageCode = null;
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

async function clickButton(text: string) {
  const button = [...element.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.trim() === text
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

async function fillEmail(value: string) {
  await act(async () => {
    const input = element.querySelector<HTMLInputElement>("#login-email")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("password login", () => {
  it("offers labeled email/password fields and recovery without automatic requests", () => {
    expect(element.querySelectorAll("form")).toHaveLength(1);
    expect(element.querySelectorAll("input")).toHaveLength(2);
    expect(element.querySelectorAll("button")).toHaveLength(3);
    expect(element.textContent).toContain("Esqueci minha senha");
    expect(element.querySelector('label[for="login-email"]')).not.toBeNull();
    expect(element.querySelector('label[for="login-password"]')).not.toBeNull();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.googleSignIn).not.toHaveBeenCalled();
    expect(mocks.sendReset).not.toHaveBeenCalled();
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
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
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
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Verifique sua conexão e tente novamente." })
    );
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain("private-provider-detail");
    await submit();
    expect(mocks.signIn).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
  });
});

describe("Google login", () => {
  it("offers Google access without requiring an email or password", async () => {
    const button = [...element.querySelectorAll<HTMLButtonElement>("button")].find(
      (candidate) => candidate.textContent?.trim() === "Entrar com Google"
    )!;
    expect(button.type).toBe("button");
    expect(mocks.googleSignIn).not.toHaveBeenCalled();
    await clickButton("Entrar com Google");
    expect(mocks.googleSignIn).toHaveBeenCalledExactlyOnceWith(
      mocks.auth,
      expect.objectContaining({ providerId: "google.com" })
    );
    expect(mocks.googleParameters).toHaveBeenCalledExactlyOnceWith({ prompt: "select_account" });
    expect(mocks.auth.languageCode).toBe("pt-BR");
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.sendReset).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("blocks duplicate clicks and password access while Google authentication is pending", async () => {
    let finish!: () => void;
    mocks.googleSignIn.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    await act(async () => {
      const googleButton = [...element.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) => candidate.textContent?.trim() === "Entrar com Google"
      )!;
      googleButton.click();
      googleButton.click();
      element
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(mocks.googleSignIn).toHaveBeenCalledOnce();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect([...element.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect([...element.querySelectorAll("input")].every((input) => input.disabled)).toBe(true);
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("does not start Google authentication during password sign-in", async () => {
    let finish!: () => void;
    mocks.signIn.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    await fillCredentials();
    await act(async () => {
      element
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      [...element.querySelectorAll<HTMLButtonElement>("button")]
        .find((candidate) => candidate.textContent?.trim() === "Entrar com Google")!
        .click();
    });
    expect(mocks.googleSignIn).not.toHaveBeenCalled();
    await act(async () => finish());
  });

  it.each(["auth/popup-closed-by-user", "auth/cancelled-popup-request"])(
    "permits retry without an error after cancellation: %s",
    async (code) => {
      mocks.googleSignIn.mockRejectedValueOnce({ code });
      await clickButton("Entrar com Google");
      expect(element.querySelector('[role="alert"]')).toBeNull();
      expect(mocks.toast).not.toHaveBeenCalled();
      expect(mocks.replace).not.toHaveBeenCalled();
      expect([...element.querySelectorAll("button")].every((button) => !button.disabled)).toBe(
        true
      );
      await clickButton("Entrar com Google");
      expect(mocks.googleSignIn).toHaveBeenCalledTimes(2);
      expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
    }
  );

  it.each([
    [
      "auth/popup-blocked",
      "Permita a abertura da janela do Google no navegador e tente novamente.",
    ],
    ["auth/network-request-failed", "Verifique sua conexão e tente novamente."],
    ["auth/too-many-requests", "Muitas tentativas. Aguarde um pouco antes de tentar novamente."],
    [
      "auth/account-exists-with-different-credential",
      "Este e-mail já usa outro método de acesso. Entre com e-mail e senha.",
    ],
    ["auth/internal-error", "Não foi possível entrar com Google. Tente novamente em instantes."],
  ])("permits retry after %s without exposing credentials", async (code, message) => {
    mocks.googleSignIn.mockRejectedValueOnce({ code, message: "private-provider-token" });
    await clickButton("Entrar com Google");
    expect(element.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(element.textContent).not.toContain("private-provider-token");
    expect(mocks.replace).not.toHaveBeenCalled();
    await clickButton("Entrar com Google");
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(mocks.googleSignIn).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("hides Google access and clears its error while recovering a password", async () => {
    mocks.googleSignIn.mockRejectedValueOnce({ code: "auth/popup-blocked" });
    await clickButton("Entrar com Google");
    await clickButton("Esqueci minha senha");
    expect(element.textContent).not.toContain("Entrar com Google");
    expect(element.querySelector('[role="alert"]')).toBeNull();
    await clickButton("Voltar ao login");
    expect(element.textContent).toContain("Entrar com Google");
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(mocks.googleSignIn).toHaveBeenCalledOnce();
  });
});

describe("password recovery", () => {
  it("keeps the email, removes the password and permits returning to login", async () => {
    await fillCredentials();
    await clickButton("Esqueci minha senha");
    expect(element.querySelector("h2")?.textContent).toBe("Recuperar senha");
    expect(element.querySelectorAll("input")).toHaveLength(1);
    expect(element.querySelector<HTMLInputElement>("#login-email")?.value).toBe(
      "Person@Example.test"
    );
    expect(element.querySelector("#login-password")).toBeNull();
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.sendReset).not.toHaveBeenCalled();
    await clickButton("Voltar ao login");
    expect(element.querySelector<HTMLInputElement>("#login-email")?.value).toBe(
      "Person@Example.test"
    );
    expect(element.querySelector<HTMLInputElement>("#login-password")?.value).toBe("");
  });

  it("requests a Portuguese reset email without signing in or redirecting", async () => {
    await clickButton("Esqueci minha senha");
    await fillEmail("Person@Example.test");
    await submit();
    expect(mocks.sendReset).toHaveBeenCalledExactlyOnceWith(mocks.auth, "person@example.test");
    expect(mocks.auth.languageCode).toBe("pt-BR");
    expect(element.querySelector('[role="status"]')?.textContent).toContain(
      "Se este e-mail estiver cadastrado"
    );
    expect(element.querySelector('[role="status"]')?.textContent).toContain("pasta de spam");
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    await submit();
    expect(mocks.sendReset).toHaveBeenCalledOnce();
  });

  it("blocks duplicate sends, changes and navigation while the request is pending", async () => {
    let finish!: () => void;
    mocks.sendReset.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    await clickButton("Esqueci minha senha");
    await fillEmail("person@example.test");
    await act(async () => {
      const form = element.querySelector("form")!;
      for (let attempt = 0; attempt < 2; attempt++) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    });
    expect(mocks.sendReset).toHaveBeenCalledOnce();
    expect([...element.querySelectorAll("button")].every((button) => button.disabled)).toBe(true);
    expect(element.querySelector<HTMLInputElement>("#login-email")?.disabled).toBe(true);
    await act(async () => finish());
    expect(element.querySelector('[role="status"]')).not.toBeNull();
    await clickButton("Voltar ao login");
    expect(element.querySelector<HTMLInputElement>("#login-email")?.disabled).toBe(false);
  });

  it.each(["", "not-an-email"])(
    "does not send a request for an invalid email: %s",
    async (email) => {
      await clickButton("Esqueci minha senha");
      await fillEmail(email);
      await submit();
      expect(mocks.sendReset).not.toHaveBeenCalled();
      expect(element.querySelector('[role="alert"]')?.textContent).toContain("e-mail válido");
    }
  );

  it("shows the same confirmation for registered and unknown email addresses", async () => {
    await clickButton("Esqueci minha senha");
    await fillEmail("person@example.test");
    await submit();
    const confirmation = element.querySelector('[role="status"]')?.textContent;
    await clickButton("Voltar ao login");
    await clickButton("Esqueci minha senha");
    mocks.sendReset.mockRejectedValueOnce({
      code: "auth/user-not-found",
      message: "private-account-detail",
    });
    await submit();
    expect(element.querySelector('[role="status"]')?.textContent).toBe(confirmation);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).not.toContain("private-account-detail");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it.each([
    ["auth/network-request-failed", "Verifique sua conexão e tente novamente."],
    ["auth/too-many-requests", "Muitas solicitações. Aguarde um pouco antes de tentar novamente."],
    ["auth/invalid-email", "Informe um e-mail válido para recuperar sua senha."],
    [
      "auth/internal-error",
      "Não foi possível solicitar a recuperação. Tente novamente em instantes.",
    ],
  ])("permits retry after %s without exposing provider details", async (code, message) => {
    await clickButton("Esqueci minha senha");
    await fillEmail("person@example.test");
    mocks.sendReset.mockRejectedValueOnce({ code, message: "private-provider-detail" });
    await submit();
    expect(element.querySelector('[role="alert"]')?.textContent).toBe(message);
    expect(element.textContent).not.toContain("private-provider-detail");
    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    await submit();
    expect(mocks.sendReset).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.querySelector('[role="status"]')).not.toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
