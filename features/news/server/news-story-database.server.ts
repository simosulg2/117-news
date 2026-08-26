import { Pool, type PoolConfig } from "pg";

import { NEWS_STORY_SCHEMA_SQL } from "./news-story-schema.server.ts";

const DATABASE_TIMEOUT_MS = 5_000;

type NewsStoryDatabaseGlobal = typeof globalThis & {
  __newsStoryPool117?: Pool;
};

export type NewsStoryDatabaseErrorDetails = {
  name: string;
  code?: string;
};

let schemaPromise: Promise<void> | null = null;
let invalidConfigurationLogged = false;

function configuredDatabaseUrl(): string | null {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
    return value;
  } catch {
    if (!invalidConfigurationLogged) {
      invalidConfigurationLogged = true;
      console.error("News story persistence is disabled because DATABASE_URL is not a valid PostgreSQL URL");
    }
    return null;
  }
}

function safeIdentifier(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[a-z][a-z0-9_.-]{0,39}$/iu.test(value)
    ? value
    : fallback;
}

function safeErrorCode(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_.-]{0,39}$/iu.test(value)
    ? value
    : undefined;
}

/** Returns fixed diagnostic fields without messages, SQL, or connection data. */
export function safeNewsStoryDatabaseErrorDetails(error: unknown): NewsStoryDatabaseErrorDetails {
  if (!error || typeof error !== "object") return { name: "UnknownError" };

  const candidate = error as { name?: unknown; code?: unknown };
  const name = safeIdentifier(candidate.name, error instanceof Error ? "Error" : "UnknownError");
  const code = safeErrorCode(candidate.code);
  return code ? { name, code } : { name };
}

export function newsStoryPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    max: 2,
    connectionTimeoutMillis: DATABASE_TIMEOUT_MS,
    statement_timeout: DATABASE_TIMEOUT_MS,
    lock_timeout: DATABASE_TIMEOUT_MS,
    query_timeout: DATABASE_TIMEOUT_MS,
    idleTimeoutMillis: 30_000,
  };
}

export function newsStoryDatabaseConfigured(): boolean {
  return configuredDatabaseUrl() !== null;
}

/** Returns the small optional pool; callers must gracefully handle null. */
export function newsStoryPool(): Pool | null {
  const connectionString = configuredDatabaseUrl();
  if (!connectionString) return null;

  const shared = globalThis as NewsStoryDatabaseGlobal;
  if (!shared.__newsStoryPool117) {
    const pool = new Pool(newsStoryPoolConfig(connectionString));
    pool.on("error", (error: Error & { code?: unknown }) => {
      console.error(
        "News story persistence idle connection failed",
        safeNewsStoryDatabaseErrorDetails(error),
      );
    });
    shared.__newsStoryPool117 = pool;
  }
  return shared.__newsStoryPool117;
}

/** Creates the optional schema once per process and retries after a failure. */
export async function ensureNewsStorySchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool.query(NEWS_STORY_SCHEMA_SQL)
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}
