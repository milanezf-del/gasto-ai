import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { createUserSupabaseClient } from "../lib/supabase";

export const rulesRoutes = new Hono<ApiAppEnv>();

rulesRoutes.use("*", requireAuth);

rulesRoutes.get("/", async (c) => {
  const user = c.get("user");
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const { data, error } = await supabase
    .from("merchant_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return c.json(
      { ok: false, error: "Não foi possível carregar as regras aprendidas." },
      500
    );
  }

  return c.json({ rules: data ?? [] });
});

rulesRoutes.delete("/:merchantNorm", async (c) => {
  const user = c.get("user");
  const merchantNorm = decodeURIComponent(c.req.param("merchantNorm"));
  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));

  const { error } = await supabase
    .from("merchant_rules")
    .delete()
    .eq("user_id", user.id)
    .eq("merchant_norm", merchantNorm);

  if (error) {
    return c.json(
      { ok: false, error: "Não foi possível remover a regra." },
      500
    );
  }

  return c.json({ ok: true });
});
