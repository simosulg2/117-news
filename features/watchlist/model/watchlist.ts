export const WATCHLIST_STORAGE_KEY = "117-watchlists-v1";
export const WATCHLIST_VERSION = 1;
export const MAX_WATCHES = 100;
export const MAX_SEEN_EVENTS = 300;

export type WatchKind =
  | "news-query"
  | "news-source"
  | "party-rating"
  | "party-threshold"
  | "coalition-majority"
  | "riigikogu-member"
  | "riigikogu-faction"
  | "riigikogu-bill"
  | "riigikogu-topic"
  | "economy-indicator"
  | "economy-release"
  | "weather-warning"
  | "political-finance-party"
  | "political-finance-donor"
  | "political-finance-topic";

export type WatchEntry = {
  id: string;
  kind: WatchKind;
  targetId: string;
  label: string;
  createdAt: string;
  partyIds?: string[];
};

export type SeenWatchEvent = { id: string; revisionId: string; seenAt: string };

export type WatchlistDocument = {
  version: 1;
  entries: WatchEntry[];
  seenEvents: SeenWatchEvent[];
};

export type WatchableEvent = {
  id: string;
  revisionId: string;
  kind: "news" | "weather-observation" | "party-rating" | "party-threshold" | "coalition-majority" | "riigikogu" | "economy" | "weather-warning" | "political-finance";
  entityIds: readonly string[];
  text: string;
  crossedThreshold?: boolean;
  hasMajority?: boolean;
  majorityChanged?: boolean;
};

const WATCH_KINDS = new Set<WatchKind>([
  "news-query", "news-source", "party-rating", "party-threshold", "coalition-majority",
  "riigikogu-member", "riigikogu-faction", "riigikogu-bill", "riigikogu-topic",
  "economy-indicator", "economy-release", "weather-warning", "political-finance-party",
  "political-finance-donor", "political-finance-topic",
]);

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return cleaned || null;
}

export function watchId(kind: WatchKind, targetId: string): string {
  return `${kind}:${targetId.trim().toLocaleLowerCase("et-EE")}`;
}

function parseEntry(value: unknown): WatchEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!WATCH_KINDS.has(raw.kind as WatchKind)) return null;
  const kind = raw.kind as WatchKind;
  const targetId = cleanText(raw.targetId, 160);
  const label = cleanText(raw.label, 160);
  const createdAt = cleanText(raw.createdAt, 40);
  if (!targetId || !label || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  const partyIds = Array.isArray(raw.partyIds)
    ? [...new Set(raw.partyIds.map((id) => cleanText(id, 80)).filter((id): id is string => Boolean(id)))].sort()
    : undefined;
  if (kind === "coalition-majority" && (!partyIds || partyIds.length === 0)) return null;
  return { id: watchId(kind, targetId), kind, targetId, label, createdAt, ...(partyIds ? { partyIds } : {}) };
}

function parseSeenEvent(value: unknown): SeenWatchEvent | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = cleanText(raw.id, 200);
  const revisionId = cleanText(raw.revisionId, 200);
  const seenAt = cleanText(raw.seenAt, 40);
  return id && revisionId && seenAt && !Number.isNaN(Date.parse(seenAt)) ? { id, revisionId, seenAt } : null;
}

export function emptyWatchlist(): WatchlistDocument {
  return { version: WATCHLIST_VERSION, entries: [], seenEvents: [] };
}

export function parseWatchlist(input: unknown): WatchlistDocument {
  if (!input || typeof input !== "object") return emptyWatchlist();
  const raw = input as Record<string, unknown>;
  const rawEntries = raw.version === 1 ? raw.entries : raw.version === 0 ? raw.watches : null;
  if (!Array.isArray(rawEntries)) return emptyWatchlist();
  const entries = new Map<string, WatchEntry>();
  for (const value of rawEntries) {
    const entry = parseEntry(value);
    if (entry && entries.size < MAX_WATCHES) entries.set(entry.id, entry);
  }
  const seenEvents = new Map<string, SeenWatchEvent>();
  if (Array.isArray(raw.seenEvents)) {
    for (const value of raw.seenEvents) {
      const event = parseSeenEvent(value);
      if (event) seenEvents.set(`${event.id}:${event.revisionId}`, event);
    }
  }
  return {
    version: WATCHLIST_VERSION,
    entries: [...entries.values()],
    seenEvents: [...seenEvents.values()]
      .sort((left, right) => Date.parse(right.seenAt) - Date.parse(left.seenAt))
      .slice(0, MAX_SEEN_EVENTS),
  };
}

export function parseStoredWatchlist(raw: string | null): WatchlistDocument {
  if (!raw) return emptyWatchlist();
  try { return parseWatchlist(JSON.parse(raw) as unknown); } catch { return emptyWatchlist(); }
}

export function parseWatchlistImport(raw: string): WatchlistDocument | null {
  let input: unknown;
  try { input = JSON.parse(raw) as unknown; } catch { return null; }
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (value.version !== WATCHLIST_VERSION || !Array.isArray(value.entries) || value.entries.length > MAX_WATCHES) return null;
  if (value.entries.some((entry) => parseEntry(entry) === null)) return null;
  if (value.seenEvents !== undefined && (!Array.isArray(value.seenEvents) || value.seenEvents.some((event) => parseSeenEvent(event) === null))) return null;
  return parseWatchlist(input);
}

export function addWatch(document: WatchlistDocument, entry: Omit<WatchEntry, "id" | "createdAt">, now = new Date()): WatchlistDocument {
  const parsed = parseEntry({ ...entry, createdAt: now.toISOString() });
  if (!parsed) throw new Error("Invalid watch entry");
  const entries = new Map(document.entries.map((item) => [item.id, item]));
  if (!entries.has(parsed.id) && entries.size >= MAX_WATCHES) throw new Error(`Watchlist limit is ${MAX_WATCHES}`);
  entries.set(parsed.id, entries.get(parsed.id) ?? parsed);
  return { ...document, entries: [...entries.values()] };
}

export function removeWatch(document: WatchlistDocument, kind: WatchKind, targetId: string): WatchlistDocument {
  const id = watchId(kind, targetId);
  return { ...document, entries: document.entries.filter((entry) => entry.id !== id) };
}

export function clearWatchHistory(document: WatchlistDocument): WatchlistDocument {
  return { ...document, seenEvents: [] };
}

export function markWatchEventSeen(document: WatchlistDocument, event: WatchableEvent, now = new Date()): WatchlistDocument {
  const seen = new Map(document.seenEvents.map((item) => [`${item.id}:${item.revisionId}`, item]));
  const value = { id: event.id, revisionId: event.revisionId, seenAt: now.toISOString() };
  seen.set(`${value.id}:${value.revisionId}`, value);
  return { ...document, seenEvents: [...seen.values()].sort((a, b) => Date.parse(b.seenAt) - Date.parse(a.seenAt)).slice(0, MAX_SEEN_EVENTS) };
}

export function watchMatchesEvent(watch: WatchEntry, event: WatchableEvent): boolean {
  const entities = new Set(event.entityIds.map((id) => id.toLocaleLowerCase("et-EE")));
  const target = watch.targetId.toLocaleLowerCase("et-EE");
  if (watch.kind === "news-query") return event.kind === "news" && event.text.toLocaleLowerCase("et-EE").includes(target);
  if (watch.kind === "news-source") return event.kind === "news" && entities.has(target);
  if (watch.kind === "party-rating") return event.kind === "party-rating" && entities.has(target);
  if (watch.kind === "party-threshold") return event.kind === "party-threshold" && entities.has(target) && event.crossedThreshold === true;
  if (watch.kind === "coalition-majority") {
    return event.kind === "coalition-majority" && event.majorityChanged === true
      && (watch.partyIds ?? []).every((id) => entities.has(id.toLocaleLowerCase("et-EE")));
  }
  if (watch.kind === "weather-warning") return event.kind === "weather-warning";
  if (watch.kind === "riigikogu-topic") return event.kind === "riigikogu" && event.text.toLocaleLowerCase("et-EE").includes(target);
  if (watch.kind.startsWith("riigikogu-")) return event.kind === "riigikogu" && entities.has(target);
  if (watch.kind.startsWith("economy-")) return event.kind === "economy" && (watch.kind === "economy-release" || entities.has(target));
  if (watch.kind === "political-finance-topic") return event.kind === "political-finance" && event.text.toLocaleLowerCase("et-EE").includes(target);
  if (watch.kind.startsWith("political-finance-")) return event.kind === "political-finance" && entities.has(target);
  return false;
}

export function watchTracksEvent(watch: WatchEntry, event: WatchableEvent): boolean {
  if (watch.kind !== "coalition-majority") return watchMatchesEvent(watch, event);
  if (event.kind !== "coalition-majority") return false;
  const entities = new Set(event.entityIds.map((id) => id.toLocaleLowerCase("et-EE")));
  return (watch.partyIds ?? []).every((id) => entities.has(id.toLocaleLowerCase("et-EE")));
}

export function isNewWatchMatch(document: WatchlistDocument, event: WatchableEvent): boolean {
  return document.entries.some((watch) => watchMatchesEvent(watch, event))
    && !document.seenEvents.some((seen) => seen.id === event.id && seen.revisionId === event.revisionId);
}
