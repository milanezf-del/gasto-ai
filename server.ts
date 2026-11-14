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
        APP_SECRET: process.env.APP_SECRET || "dev-secret",
      } as never);

      res.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

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
