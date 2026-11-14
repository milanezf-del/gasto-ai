import type { Ai } from "@cloudflare/workers-types";

export interface Bindings {
  AI?: Ai;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  TURNSTILE_SECRET?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface Variables {
  user: AuthUser;
  accessToken: string;
}

export interface ApiAppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
