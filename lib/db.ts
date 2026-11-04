import { neon, neonConfig } from "@neondatabase/serverless";

// Server-side only. Neon Postgres over HTTP (works well on Vercel serverless).
// DATABASE_URL is added automatically when Neon is connected to the Vercel project.

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured.");
    this.name = "DatabaseNotConfiguredError";
  }
}

let client: ReturnType<typeof neon> | null = null;

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  if (!client) {
    // Local testing only: route queries to a local Neon-compatible HTTP proxy.
    // Ignored on Vercel so it can never redirect production traffic.
    const localEndpoint = process.env.NEON_LOCAL_FETCH_ENDPOINT;
    if (localEndpoint && !process.env.VERCEL) neonConfig.fetchEndpoint = localEndpoint;
    client = neon(url);
  }
  return client;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Parameterized query. Always pass user-controlled values via `params`, never string concatenation. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await getClient().query(text, params)) as T[];
}
