import type { NewsArticle } from "@/lib/types";

export const READ_STORAGE_KEY = "117-read-articles";
export const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export type ReadTimestamps = Record<string, number>;

export function readKeyForItem(item: NewsArticle): string {
  const link = item.link.trim();
  if (!link) return `id:${item.id}`;

  try {
    const url = new URL(link);
    url.hash = "";
    return `url:${url.toString()}`;
  } catch {
    return `url:${link}`;
  }
}

export function pruneReadTimestamps(value: unknown, nowMs = Date.now()): ReadTimestamps {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const cutoff = nowMs - READ_RETENTION_MS;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] =>
        Boolean(entry[0]) && typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= cutoff,
    ),
  );
}

export function parseReadTimestamps(value: string | null, nowMs = Date.now()): ReadTimestamps {
  if (!value) return {};
  try {
    return pruneReadTimestamps(JSON.parse(value) as unknown, nowMs);
  } catch {
    return {};
  }
}
