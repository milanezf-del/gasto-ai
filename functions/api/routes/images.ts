import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import { requireAuth } from "../middleware/auth";
import { createUserSupabaseClient } from "../lib/supabase";
import { pgByteaToUint8 } from "../lib/aiClient";
import { uuidSchema } from "../schemas";

export const imagesRoutes = new Hono<ApiAppEnv>();

imagesRoutes.use("*", requireAuth);

imagesRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const idCheck = uuidSchema.safeParse(c.req.param("id"));
  if (!idCheck.success) {
    return c.json({ ok: false, error: "ID de imagem inválido." }, 400);
  }

  const supabase = createUserSupabaseClient(c.env, c.get("accessToken"));
  const { data, error } = await supabase
    .from("images")
    .select("id, user_id, mime, data")
    .eq("id", idCheck.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[Gastô Get Image Error]", error);
    return c.json(
      { ok: false, error: "Não foi possível carregar a imagem." },
      500
    );
  }

  if (!data) {
    return c.json({ ok: false, error: "Imagem não encontrada." }, 404);
  }

  const row = data as { mime: string; data: unknown };
  const bytes = pgByteaToUint8(row.data);
  if (!bytes || bytes.byteLength === 0) {
    return c.json({ ok: false, error: "Arquivo de imagem indisponível." }, 404);
  }

  const safeBody = new Uint8Array(bytes.byteLength);
  safeBody.set(bytes);

  return new Response(safeBody.buffer, {
    status: 200,
    headers: {
      "Content-Type": row.mime || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
