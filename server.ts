import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app as honoApiApp } from "./functions/api/app.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const expressApp = express();

  // Headers de segurança básicos no servidor local
  expressApp.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(), geolocation=()"
    );
    next();
  });

  // Forward /api/* requests directly to the Hono Pages Functions app
  expressApp.use("/api", async (req, res, next) => {
    try {
      const protocol = req.protocol || "http";
      const host = req.get("host") || `localhost:${PORT}`;
      const fullUrl = new URL(req.originalUrl, `${protocol}://${host}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") {
          headers.set(key, value);
        } else if (Array.isArray(value)) {
          headers.set(key, value.join(", "));
        }
      }

      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const chunks: Buffer[] = [];
      if (hasBody) {
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
      }

      const webRequest = new Request(fullUrl.toString(), {
        method: req.method,
        headers,
        body: hasBody && chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      });

      const webResponse = await honoApiApp.fetch(webRequest, {
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? "",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        TURNSTILE_SECRET: process.env.TURNSTILE_SECRET,
      });

      res.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") return;
        res.setHeader(key, value);
      });

      const setCookies =
        typeof (webResponse.headers as unknown as { getSetCookie?: () => string[] })
          .getSetCookie === "function"
          ? (webResponse.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
          : [];
      if (setCookies.length > 0) {
        res.setHeader("Set-Cookie", setCookies);
      } else {
        const singleCookie = webResponse.headers.get("set-cookie");
        if (singleCookie) res.setHeader("Set-Cookie", singleCookie);
      }

      const arrayBuffer = await webResponse.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      next(err);
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    expressApp.use(express.static(distPath));
    expressApp.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  expressApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Gastô dev server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
