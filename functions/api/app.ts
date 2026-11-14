import { Hono } from "hono";
import type { ApiAppEnv } from "./types";
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { summaryRoutes } from "./routes/summary";
import { dashboardRoutes } from "./routes/dashboard";
import { expensesRoutes } from "./routes/expenses";
import { imagesRoutes } from "./routes/images";
import { budgetsRoutes } from "./routes/budgets";
import { rulesRoutes } from "./routes/rules";
import { insightsRoutes } from "./routes/insights";
import { assistantRoutes } from "./routes/assistant";
import { accountRoutes } from "./routes/account";
import { aiStage5Routes } from "./ai";

export const app = new Hono<ApiAppEnv>().basePath("/api");

app.route("/health", healthRoutes);
app.route("/auth", authRoutes);
app.route("/summary", summaryRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/expenses", expensesRoutes);
app.route("/images", imagesRoutes);
app.route("/budgets", budgetsRoutes);
app.route("/rules", rulesRoutes);
app.route("/insights", insightsRoutes);
app.route("/assistant", assistantRoutes);
app.route("/account", accountRoutes);
app.route("/ai", aiStage5Routes);

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: "Recurso de API não encontrado.",
    },
    404
  );
});

app.onError((err, c) => {
  console.error("[Gastô API Error]", err);
  return c.json(
    {
      ok: false,
      error:
        "Ocorreu um erro interno ao processar sua solicitação. Tente novamente.",
    },
    500
  );
});
