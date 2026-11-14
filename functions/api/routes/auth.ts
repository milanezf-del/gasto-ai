import { Hono } from "hono";
import type { ApiAppEnv } from "../types";
import {
  createAnonSupabaseClient,
  createUserSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase";
import { verifyTurnstileIfEnabled } from "../lib/turnstile";
import {
  clearAuthCookies,
  requireAuth,
  setAuthCookies,
} from "../middleware/auth";
import { addDaysIso, getTodaySaoPaulo } from "../lib/dates";
import { loginSchema, signupSchema } from "../schemas";

export const authRoutes = new Hono<ApiAppEnv>();

authRoutes.post("/signup", async (c) => {
  if (!isSupabaseConfigured(c.env)) {
    return c.json(
      { ok: false, error: "Supabase não configurado no servidor." },
      503
    );
  }

  const body = (await c.req.json().catch(() => null)) as
    | (Record<string, unknown> & { turnstileToken?: string })
    | null;

  const turnstile = await verifyTurnstileIfEnabled(
    c.env,
    typeof body?.turnstileToken === "string" ? body.turnstileToken : undefined,
    c.req.header("cf-connecting-ip") ?? null
  );
  if (!turnstile.ok) {
    return c.json({ ok: false, error: turnstile.error }, 400);
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Dados de cadastro inválidos.",
      },
      400
    );
  }

  const supabase = createAnonSupabaseClient(c.env);
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase().includes("already registered")
      ? "Este e-mail já está cadastrado."
      : "Não foi possível criar sua conta. Verifique os dados informados.";
    return c.json({ ok: false, error: msg }, 400);
  }

  if (data.session) {
    setAuthCookies(c, data.session);
  }

  return c.json(
    {
      ok: true,
      requiresEmailConfirmation: !data.session,
      user: data.user
        ? {
            id: data.user.id,
            email: (data.user.email ?? parsed.data.email).toLowerCase(),
            name: parsed.data.name,
          }
        : null,
    },
    201
  );
});

authRoutes.post("/login", async (c) => {
  if (!isSupabaseConfigured(c.env)) {
    return c.json(
      { ok: false, error: "Supabase não configurado no servidor." },
      503
    );
  }

  const body = (await c.req.json().catch(() => null)) as
    | (Record<string, unknown> & { turnstileToken?: string })
    | null;

  const turnstile = await verifyTurnstileIfEnabled(
    c.env,
    typeof body?.turnstileToken === "string" ? body.turnstileToken : undefined,
    c.req.header("cf-connecting-ip") ?? null
  );
  if (!turnstile.ok) {
    return c.json({ ok: false, error: turnstile.error }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Credenciais inválidas.",
      },
      400
    );
  }

  const supabase = createAnonSupabaseClient(c.env);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.session || !data.user) {
    const isUnconfirmed = error?.message
      .toLowerCase()
      .includes("email not confirmed");
    return c.json(
      {
        ok: false,
        error: isUnconfirmed
          ? "Confirme seu e-mail antes de entrar."
          : "E-mail ou senha incorretos.",
      },
      401
    );
  }

  setAuthCookies(c, data.session);

  // Limpeza leve no login (sem cron): remove registros antigos (> 90 dias) de uso de IA do próprio usuário
  try {
    const cutoffIso = addDaysIso(getTodaySaoPaulo(), -90);
    if (cutoffIso) {
      const userClient = createUserSupabaseClient(
        c.env,
        data.session.access_token
      );
      await userClient
        .from("ai_usage")
        .delete()
        .eq("user_id", data.user.id)
        .lt("day", cutoffIso);
    }
  } catch {
    // Limpeza não bloqueia o login
  }

  const metaName =
    typeof data.user.user_metadata?.name === "string"
      ? data.user.user_metadata.name
      : null;

  return c.json({
    ok: true,
    user: {
      id: data.user.id,
      email: (data.user.email ?? parsed.data.email).toLowerCase(),
      name: metaName,
    },
  });
});

authRoutes.post("/logout", async (c) => {
  clearAuthCookies(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({ ok: true, user });
});
