import { Hono } from "hono";
import type { ApiAppEnv } from "../types";

export const healthRoutes = new Hono<ApiAppEnv>();

healthRoutes.get("/", (c) => {
  return c.json({ ok: true });
});
