import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContext } from "@/lib/auth/auth-context";
const mock = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mock.collection } }));
import { getAuthorizedMedicalHistory } from "./medical-history";
const user: AuthContext = {
  uid: "doctor",
  email: "doctor@example.test",
  role: "DOCTOR",
  tenantId: "tenant-a",
  permissions: [],
  servedCompanies: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  const chain = {
    collection: mock.collection,
    doc: mock.doc,
    where: mock.where,
    orderBy: mock.orderBy,
    limit: mock.limit,
    get: mock.get,
  };
  for (const fn of [mock.collection, mock.doc, mock.where, mock.orderBy, mock.limit])
    fn.mockReturnValue(chain);
  mock.get.mockResolvedValue({ empty: true, docs: [] });
});
describe("authorized clinical history", () => {
  it("denies tenant administrators foreign history before accessing the database", async () => {
    await expect(
      getAuthorizedMedicalHistory({ ...user, role: "ADMIN" }, "tenant-b", "patient")
    ).rejects.toThrow("Empresa não liberada");
    expect(mock.collection).not.toHaveBeenCalled();
  });
  it("uses both authorized company and exact patient identity", async () => {
    const result = await getAuthorizedMedicalHistory(user, "tenant-a", "patient");
    expect(mock.doc).toHaveBeenCalledWith("tenant-a");
    expect(mock.collection).toHaveBeenCalledWith("aso_attendances");
    expect(mock.where).toHaveBeenCalledWith("employeeId", "==", "patient");
    expect(mock.limit).toHaveBeenCalledWith(1);
    expect(result.statusConsulta).toBe("SEM_REGISTROS");
    expect(result.aviso).toContain("Não inferir aptidão");
  });
  it("distinguishes a failed query from no records", async () => {
    mock.get.mockRejectedValueOnce(new Error("database offline"));
    expect((await getAuthorizedMedicalHistory(user, "tenant-a", "patient")).statusConsulta).toBe(
      "INDISPONIVEL"
    );
  });
  it("returns only bounded relevant history fields", async () => {
    mock.get.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          data: () => ({
            data_emissao: "2026-10-18",
            resultado: "Pendente",
            restricoes: [null, 3, ...Array.from({ length: 40 }, (_, i) => `Nota ${i}`)],
            privateUnrelated: "must not leave server",
          }),
        },
      ],
    });
    const result = await getAuthorizedMedicalHistory(user, "tenant-a", "patient");
    expect(result).toMatchObject({ statusConsulta: "CONSULTADO", resultado: "Pendente" });
    expect(result.restricoes).toHaveLength(30);
    expect(result).not.toHaveProperty("privateUnrelated");
  });
  it.each([null, 5, "", " ", "patient/other", "patient\\other", "patient\n", "x".repeat(129)])(
    "rejects malformed patient %j before querying",
    async (patient) => {
      await expect(
        getAuthorizedMedicalHistory(user, "tenant-a", patient as string)
      ).rejects.toThrow("Paciente inválido");
      expect(mock.collection).not.toHaveBeenCalled();
    }
  );
});
