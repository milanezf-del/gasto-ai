import type { Ai, D1Database } from "@cloudflare/workers-types";

export interface Bindings {
  DB: D1Database;
  AI: Ai;
  APP_SECRET: string;
}

export interface ApiAppEnv {
  Bindings: Bindings;
}
