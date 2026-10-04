import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  spec: {
    url: "/api/v1/openapi.json",
  },
  theme: "deepSpace",
});
