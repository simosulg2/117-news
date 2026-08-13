import { NEWS_SNAPSHOT_TTL_MS, NEWS_STALE_RETRY_DELAY_MS } from "./feed-config";
import { refreshNewsSnapshot } from "./news-snapshot.server";
import { InProcessSnapshotCache } from "../../../lib/snapshot-cache.ts";
import type { NewsResponse } from "../../../lib/types.ts";

const newsSnapshotCache = new InProcessSnapshotCache<NewsResponse>(
  NEWS_SNAPSHOT_TTL_MS,
  NEWS_STALE_RETRY_DELAY_MS,
);

export function getNewsSnapshot() {
  return newsSnapshotCache.get(refreshNewsSnapshot);
}
