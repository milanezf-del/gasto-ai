import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Session } from "@supabase/supabase-js";
import type { ApiAppEnv } from "../types";
import {
  createAnonSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase";

export const ACCESS_COOKIE = "gasto_access_token";
export const REFRESH_COOKIE = "gasto_refresh_token";

function isHttpsRequest(c: Context<ApiAppEnv>): boolean {
  try {
    const url = new URL(c.req.url);
    return (
      url.protocol === "https:" ||
      c.req.header("x-forwarded-proto") === "https"
    );
  } catch {
    return false;
  }
}

export function setAuthCookies(
  c: Context<ApiAppEnv>,
  session: Session
): void {
  const secure = isHttpsRequest(c);

  setCookie(c, ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    maxAge: session.expires_in ?? 3600,
  });

  if (session.refresh_token) {
    setCookie(c, REFRESH_COOKIE, session.refresh_token, {
      httpOnly: true,
      secure,
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dias
    });
  }
}

export function clearAuthCookies(c: Context<ApiAppEnv>): void {
  const secure = isHttpsRequest(c);
  deleteCookie(c, ACCESS_COOKIE, { path: "/", secure, sameSite: "Lax" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/", secure, sameSite: "Lax" });
}

export async function requireAuth(
  c: Context<ApiAppEnv>,
  next: Next
): Promise<Response | void> {
  if (!isSupabaseConfigured(c.env)) {
    return c.json(
      {
        ok: false,
        error:
          "Supabase não configurado no servidor. Defina SUPABASE_URL e SUPABASE_ANON_KEY.",
      },
      503
    );
  }

  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  let accessToken = bearerToken || getCookie(c, ACCESS_COOKIE);
  const refreshToken = getCookie(c, REFRESH_COOKIE);

  if (!accessToken && !refreshToken) {
    return c.json(
      { ok: false, error: "Sessão não iniciada. Faça login para continuar." },
      401
    );
  }

  const supabase = createAnonSupabaseClient(c.env);

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) {
      const metaName =
        typeof data.user.user_metadata?.name === "string"
          ? data.user.user_metadata.name
          : null;
      c.set("user", {
        id: data.user.id,
        email: (data.user.email ?? "").toLowerCase(),
        name: metaName,
      });
      c.set("accessToken", accessToken);
      await next();
      return;
    }
  }

  if (refreshToken) {
    const { data: refreshed, error: refreshErr } =
      await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

    if (!refreshErr && refreshed.session && refreshed.user) {
      setAuthCookies(c, refreshed.session);
      const metaName =
        typeof refreshed.user.user_metadata?.name === "string"
          ? refreshed.user.user_metadata.name
          : null;
      c.set("user", {
        id: refreshed.user.id,
        email: (refreshed.user.email ?? "").toLowerCase(),
        name: metaName,
      });
      c.set("accessToken", refreshed.session.access_token);
      await next();
      return;
    }
  }

  clearAuthCookies(c);
  return c.json(
    { ok: false, error: "Sua sessão expirou. Faça login novamente." },
    401
  );
}
