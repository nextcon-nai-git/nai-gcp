import { beforeEach, describe, expect, it, vi } from "vitest";
import { batchWriteOptimized, type OptimizedBatchWrite } from "./non-blocking-updates";

const mocks = vi.hoisted(() => ({
  batch: {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  },
  writeBatch: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: mocks.writeBatch,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.writeBatch.mockReturnValue(mocks.batch);
  mocks.batch.commit.mockResolvedValue(undefined);
});

describe("batchWriteOptimized", () => {
  it("commits operations in Firestore-sized chunks", async () => {
    const ref = { path: "companies/test/tasks/doc" };
    const writes: OptimizedBatchWrite[] = Array.from({ length: 501 }, () => ({
      type: "set",
      ref: ref as never,
      data: { title: "Task" },
    }));

    await batchWriteOptimized({} as never, writes);

    expect(mocks.writeBatch).toHaveBeenCalledTimes(2);
    expect(mocks.batch.set).toHaveBeenCalledTimes(501);
    expect(mocks.batch.commit).toHaveBeenCalledTimes(2);
  });
});
