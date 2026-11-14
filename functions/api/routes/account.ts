import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { createUserSupabaseClient } from "../lib/supabase";

export const accountRoutes = new Hono<ApiAppEnv>();

accountRoutes.use("*", requireAuth);

const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((v) => v === "EXCLUIR", {
      message: 'Digite exatamente "EXCLUIR" para confirmar a exclusão da conta.',
    }),
});

accountRoutes.delete("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const body = await c.req.json().catch(() => null);
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          'Confirmação inválida. Digite "EXCLUIR".',
      },
      400
    );
  }

  try {
    // Remove dados do usuário em todas as tabelas filtrando explicitamente por user_id / id da sessão
    await supabase.from("insights_cache").delete().eq("user_id", user.id);
    await supabase.from("ai_usage").delete().eq("user_id", user.id);
    await supabase.from("merchant_rules").delete().eq("user_id", user.id);
    await supabase.from("budgets").delete().eq("user_id", user.id);
    await supabase.from("expenses").delete().eq("user_id", user.id);
    await supabase.from("images").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("id", user.id);

    // Se service role estiver disponível no ambiente, remove também o registro em auth.users
    if (c.env.SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      await adminClient.auth.admin.deleteUser(user.id);
    }
  } catch (err) {
    console.error("[Gastô Delete Account Error]", err);
    return c.json(
      {
        ok: false,
        error: "Não foi possível excluir todos os seus dados no momento.",
      },
      500
    );
  }

  deleteCookie(c, "gasto_access_token", { path: "/" });
  deleteCookie(c, "gasto_refresh_token", { path: "/" });

  return c.json({ ok: true });
});
