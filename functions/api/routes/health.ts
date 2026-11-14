import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { isSupabaseConfigured } from "../lib/supabase";

export const healthRoutes = new Hono<ApiAppEnv>();

healthRoutes.get("/", (c) => {
  return c.json({
    ok: true,
    database: "supabase",
    configured: isSupabaseConfigured(c.env),
  });
});
