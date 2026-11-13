// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ generation: 0, held: false, created: 0 }));
vi.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      file: () => ({
        async save(
          _id: string,
          options: { preconditionOpts: { ifGenerationMatch: number | string } }
        ) {
          if (
            Number(options.preconditionOpts.ifGenerationMatch) !==
            (state.held ? state.generation : 0)
          )
            throw Object.assign(Error(), { code: 412 });
          state.held = true;
          state.generation++;
          state.created = Date.now();
        },
        async getMetadata() {
          return [
            { generation: state.generation, timeCreated: new Date(state.created).toISOString() },
          ];
        },
        async delete(options: { ifGenerationMatch: string }) {
          if (Number(options.ifGenerationMatch) !== state.generation)
            throw Error("generation mismatch");
          state.held = false;
        },
      }),
    }),
  }),
}));
import { withProductionFinanceLock } from "./financial-production-lock";
beforeEach(() => {
  state.held = false;
  state.generation = 0;
});
it("serializa alterações concorrentes e libera o bloqueio em caso de falha", async () => {
  await expect(
    withProductionFinanceLock("first", async () => {
      const write = vi.fn();
      await expect(withProductionFinanceLock("second", write)).rejects.toMatchObject({
        status: 409,
      });
      expect(write).not.toHaveBeenCalled();
      throw Error("failed");
    })
  ).rejects.toThrow("failed");
  await expect(withProductionFinanceLock("retry", async () => 1)).resolves.toBe(1);
});
it("recupera um bloqueio órfão com precondição de geração", async () => {
  state.held = true;
  state.generation = 4;
  state.created = Date.now() - 3 * 3600000;
  await withProductionFinanceLock("recovered", async () => expect(state.generation).toBe(5));
  expect(state.held).toBe(false);
});
