import { Hono } from "hono";
import type { ApiAppEnv } from "./types";
import { healthRoutes } from "./routes/health";

export const app = new Hono<ApiAppEnv>().basePath("/api");

app.route("/health", healthRoutes);

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: "Recurso de API não encontrado ou ainda não implementado nesta etapa.",
    },
    404
  );
});

app.onError((err, c) => {
  console.error("[Gastô API Error]", err);
  return c.json(
    {
      ok: false,
      error: "Ocorreu um erro interno ao processar sua solicitação. Tente novamente.",
    },
    500
  );
});
