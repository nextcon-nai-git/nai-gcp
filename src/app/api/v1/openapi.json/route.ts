import { NextResponse } from "next/server";

const openApiSchema = {
  openapi: "3.0.3",
  info: {
    title: "NAI Developer Hub API",
    version: "3.3.0",
    description:
      "APIs abertas de alta performance para validação de acesso em catracas, integração com ERPs e automação de SST.",
  },
  servers: [{ url: "/api/v1", description: "Ambiente Local / Produção" }],
  paths: {
    "/access-control/check": {
      post: {
        summary: "Checagem de liberação de acesso (Catracas e REPs)",
        description:
          "Valida se o colaborador está com ASO em dia e treinamentos NRs válidos no contexto da unidade.",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cpf: {
                    type: "string",
                    description: "CPF do colaborador (apenas números)",
                    example: "12345678900",
                  },
                  badgeCode: {
                    type: "string",
                    description: "Código do crachá/cartão",
                    example: "CR-90821",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Resultado da validação de acesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    allowed: { type: "boolean", example: false },
                    reason: {
                      type: "string",
                      example: "Acesso bloqueado: Treinamento pendente/vencido (NR-35).",
                    },
                    employeeName: { type: "string", example: "ERICK HENRIQUE" },
                    asoStatus: { type: "string", example: "VALID" },
                    asoDueDate: { type: "string", example: "2026-11-20T00:00:00.000Z" },
                    missingNrs: { type: "array", items: { type: "string" }, example: ["NR-35"] },
                    timestamp: { type: "string", example: "2026-08-05T23:00:00.000Z" },
                  },
                },
              },
            },
          },
          "401": { description: "API Key inválida ou ausente" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-NAI-API-Key",
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSchema, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
