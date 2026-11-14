import type { PagesFunction } from "@cloudflare/workers-types";

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();
  const headers = new Headers(response.headers);

  headers.set("Content-Security-Policy", CSP_DIRECTIVES);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()"
  );

  try {
    const reqUrl = new URL(context.request.url);
    if (reqUrl.protocol === "https:") {
      headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }
  } catch {
    // Ignora falha de parse da URL
  }

  return new Response(response.body as unknown as BodyInit | null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }) as unknown as Awaited<ReturnType<PagesFunction>>;
};
