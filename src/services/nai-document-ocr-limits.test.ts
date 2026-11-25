// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { readNaiScan } from "./nai-document-ocr";

const worker = vi.hoisted(() => ({ start: vi.fn(), terminate: vi.fn() }));
vi.mock("node:worker_threads", () => ({
  Worker: class extends EventEmitter {
    constructor() {
      super();
      worker.start(this);
    }
    terminate = worker.terminate;
  },
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("encerra em 35 segundos e libera o leitor para outra tentativa", async () => {
  vi.useFakeTimers();
  const result = readNaiScan("data:image/png;base64,AAAA", 1);
  await vi.advanceTimersByTimeAsync(35000);
  expect(await result).toEqual({ status: "timeout" });
  expect(worker.terminate).toHaveBeenCalledOnce();
  const retry = readNaiScan("data:image/png;base64,AAAA", 1);
  worker.start.mock.calls[1][0].emit("message", { status: "ok", texts: ["texto"] });
  expect(await retry).toMatchObject({ status: "ok" });
});
it("distingue uma dependência ausente e descarta o erro original", async () => {
  const result = readNaiScan("data:image/png;base64,AAAA", 1);
  worker.start.mock.calls[0][0].emit(
    "error",
    Object.assign(new Error("sensitive-file-path"), { code: "ERR_MODULE_NOT_FOUND" })
  );
  expect(await result).toEqual({ status: "dependency" });
});
