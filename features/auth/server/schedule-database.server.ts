import { Pool, type PoolConfig } from "pg";

import { SCHEDULE_SCHEMA_SQL } from "./schedule-schema.server.ts";

const DATABASE_TIMEOUT_MS = 5_000;

type ScheduleDatabaseGlobal = typeof globalThis & {
  __schedulePool117?: Pool;
};

let schemaPromise: Promise<void> | null = null;
let invalidConfigurationLogged = false;

function safeDiagnostic(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[a-z][a-z0-9_.-]{0,39}$/iu.test(value)
    ? value
    : fallback;
}

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
      console.error("Schedule persistence is disabled because DATABASE_URL is invalid.");
    }
    return null;
  }
}

export class SchedulePersistenceUnavailableError extends Error {
  constructor() {
    super("Ajakava salvestus pole saadaval.");
    this.name = "SchedulePersistenceUnavailableError";
  }
}

export function schedulePoolConfig(connectionString: string): PoolConfig {
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

export function schedulePersistenceConfigured(): boolean {
  return configuredDatabaseUrl() !== null
    && /^[A-Za-z0-9_-]{43}$/u.test(process.env.SCHEDULE_DATA_KEY?.trim() ?? "");
}

export function schedulePool(): Pool | null {
  const connectionString = configuredDatabaseUrl();
  if (!connectionString) return null;

  const shared = globalThis as ScheduleDatabaseGlobal;
  if (!shared.__schedulePool117) {
    const pool = new Pool(schedulePoolConfig(connectionString));
    pool.on("error", (error: Error & { code?: unknown }) => {
      console.error("Schedule persistence idle connection failed", {
        name: safeDiagnostic(error.name, "Error"),
        code: typeof error.code === "string"
          ? safeDiagnostic(error.code, "DatabaseError")
          : undefined,
      });
    });
    shared.__schedulePool117 = pool;
  }
  return shared.__schedulePool117;
}

export function requireSchedulePool(): Pool {
  if (!schedulePersistenceConfigured()) {
    throw new SchedulePersistenceUnavailableError();
  }
  const pool = schedulePool();
  if (!pool) throw new SchedulePersistenceUnavailableError();
  return pool;
}

export async function ensureScheduleSchema(pool: Pool): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool.query(SCHEDULE_SCHEMA_SQL)
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaPromise = null;
        throw error;
      });
  }
  return schemaPromise;
}
