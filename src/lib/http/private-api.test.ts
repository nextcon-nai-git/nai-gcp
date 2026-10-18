// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { limitedBytes, limitedFormData, limitedJson } from "./private-api";

describe("limites de leitura HTTP", () => {
  it.each([undefined, "1"])(
    "interrompe o fluxo acima do limite com Content-Length %s",
    async (length) => {
      const cancel = vi.fn();
      const request = new NextRequest("https://nai.example/upload", {
        method: "POST",
        headers: length ? { "content-length": length } : {},
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(6));
            controller.enqueue(new Uint8Array(6));
          },
          cancel,
        }),
        duplex: "half",
      } as ConstructorParameters<typeof NextRequest>[1]);
      await expect(limitedBytes(request, 10)).rejects.toMatchObject({ status: 413 });
      expect(cancel).toHaveBeenCalledOnce();
      expect(request.body?.locked).toBe(false);
    }
  );
  it("aceita exatamente o limite e rejeita corpo ausente", async () => {
    expect(
      await limitedBytes(
        new NextRequest("https://nai.example/upload", { method: "POST", body: "12345" }),
        5
      )
    ).toEqual(Buffer.from("12345"));
    await expect(
      limitedBytes(new NextRequest("https://nai.example/upload"), 5)
    ).rejects.toMatchObject({ status: 400 });
  });
  it("libera a leitura quando a origem falha", async () => {
    const request = new NextRequest("https://nai.example/upload", {
      method: "POST",
      body: new ReadableStream({
        start(controller) {
          controller.error(new Error("source failure"));
        },
      }),
      duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    await expect(limitedBytes(request, 5)).rejects.toThrow("source failure");
    expect(request.body?.locked).toBe(false);
  });
  it("decodifica multipart preservando nome, campos e bytes do arquivo", async () => {
    const form = new FormData();
    form.set("confirmed", "true");
    form.set("file", new File(["%PDF-synthetic"], "Laudo João.PDF", { type: "application/pdf" }));
    const request = new NextRequest("https://nai.example/upload", { method: "POST", body: form });
    const result = await limitedFormData(request, 2048);
    const file = result.get("file") as File;
    expect(result.get("confirmed")).toBe("true");
    expect(file.name).toBe("Laudo João.PDF");
    expect(await file.text()).toBe("%PDF-synthetic");
  });
  it("rejeita multipart inválido e tipo incorreto com erro de entrada", async () => {
    for (const type of [
      "application/json",
      "multipart/form-data",
      "multipart/form-data; boundary=x",
    ]) {
      await expect(
        limitedFormData(
          new NextRequest("https://nai.example/upload", {
            method: "POST",
            headers: { "content-type": type },
            body: "broken",
          }),
          100
        )
      ).rejects.toMatchObject({ status: 400 });
    }
  });
  it("rejeita Content-Length excedido antes de consumir o arquivo", async () => {
    const request = new NextRequest("https://nai.example/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x", "content-length": "1000" },
      body: "body",
    });
    await expect(limitedFormData(request, 100)).rejects.toMatchObject({ status: 413 });
    expect(request.bodyUsed).toBe(false);
  });
  it("valida JSON sem expor conteúdo de parse inválido", async () => {
    const request = (body: string, type = "application/json") =>
      new NextRequest("https://nai.example/json", {
        method: "POST",
        headers: { "content-type": type },
        body,
      });
    expect(await limitedJson(request('{"value":1}'))).toEqual({ value: 1 });
    await expect(limitedJson(request("private-diagnostic"))).rejects.toMatchObject({
      status: 400,
      message: "JSON inválido.",
    });
    await expect(limitedJson(request("{}", "text/plain"))).rejects.toMatchObject({ status: 400 });
  });
});
