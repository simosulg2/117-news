import type { NewsArticle } from "@/lib/types";
import {
  ensureNewsStorySchema,
  newsStoryPool,
} from "./news-story-database.server.ts";
import {
  ingestNewsStoryBatch,
  type NewsStoryIngestResult,
} from "./news-story-ingestion.server.ts";

export type NewsStoryCollectionResult = NewsStoryIngestResult & {
  collectedAt: string;
};

/** Persists one feed snapshot atomically; null means the optional store is disabled. */
export async function collectNewsStoryBatch(
  articles: readonly NewsArticle[],
  collectedAt = new Date(),
): Promise<NewsStoryCollectionResult | null> {
  const pool = newsStoryPool();
  if (!pool) return null;
  await ensureNewsStorySchema(pool);

  const client = await pool.connect();
  let discardClient = false;
  try {
    await client.query("BEGIN");
    const result = await ingestNewsStoryBatch(client, articles, collectedAt);
    await client.query("COMMIT");
    return { ...result, collectedAt: collectedAt.toISOString() };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discardClient = true;
    }
    throw error;
  } finally {
    client.release(discardClient);
  }
}
