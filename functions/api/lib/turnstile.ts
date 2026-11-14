import type { Bindings } from "../types";

export interface TurnstileVerifyResult {
  ok: boolean;
  error?: string;
}

export async function verifyTurnstileIfEnabled(
  env: Bindings,
  token: string | undefined,
  remoteIp: string | null
): Promise<TurnstileVerifyResult> {
  const secret = env.TURNSTILE_SECRET?.trim();
  if (!secret) {
    return { ok: true };
  }

  if (!token || !token.trim()) {
    return {
      ok: false,
      error: "Confirme a verificação de segurança (Turnstile) antes de continuar.",
    };
  }

  try {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token.trim());
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!res.ok) {
      return {
        ok: false,
        error: "Não foi possível validar o desafio antirrobô. Tente novamente.",
      };
    }

    const data = (await res.json()) as { success?: boolean };
    if (!data.success) {
      return {
        ok: false,
        error: "Verificação antirrobô recusada. Atualize o desafio e tente novamente.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[Gastô Turnstile Verify Error]", err);
    return {
      ok: false,
      error: "Falha ao validar a verificação de segurança. Tente novamente.",
    };
  }
}
