import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-nai-security",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/security"), {
      role: "SUPER_ADMIN",
      accessEnabled: true,
    });
    await setDoc(doc(ctx.firestore(), "users/admin"), {
      role: "ADMIN",
      companyId: "nextcon",
      accessEnabled: true,
    });
    await setDoc(doc(ctx.firestore(), "users/ops"), {
      role: "OPERATIONS",
      companyId: "nextcon",
      accessEnabled: true,
    });
    await setDoc(doc(ctx.firestore(), "denuncias/DEN-TEST"), {
      tipoRelato: "identificado",
      dadosIdentificacao: { nome: "Pessoa", email: "pessoa@example.test" },
      categoria: "assedio_moral",
      status: "triagem",
    });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("compliance report rules", () => {
  it("allows only security admin browser reads", async () => {
    await assertSucceeds(
      getDoc(doc(env.authenticatedContext("security").firestore(), "denuncias/DEN-TEST"))
    );
    for (const uid of ["admin", "ops"])
      await assertFails(
        getDoc(doc(env.authenticatedContext(uid).firestore(), "denuncias/DEN-TEST"))
      );
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "denuncias/DEN-TEST")));
  });

  it("denies all browser writes because reports are server-created", async () => {
    const payload = {
      tipoRelato: "anonimo",
      dadosIdentificacao: { nome: null, email: null },
      categoria: "assedio_moral",
      status: "triagem",
    };
    await assertFails(
      setDoc(doc(env.unauthenticatedContext().firestore(), "denuncias/FORGED"), payload)
    );
    await assertFails(
      setDoc(doc(env.authenticatedContext("security").firestore(), "denuncias/FORGED"), payload)
    );
  });

  it("also protects nested future compliance records", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "denuncias/DEN-TEST/mensagens/M1"), { texto: "restrito" });
    });
    await assertSucceeds(
      getDoc(
        doc(env.authenticatedContext("security").firestore(), "denuncias/DEN-TEST/mensagens/M1")
      )
    );
    await assertFails(
      getDoc(doc(env.authenticatedContext("admin").firestore(), "denuncias/DEN-TEST/mensagens/M1"))
    );
  });
});
