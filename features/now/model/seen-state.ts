import type { NowArea, NowCard } from "../../../lib/now-types.ts";

export const NOW_SEEN_STORAGE_KEY = "117-now-seen-v1";
const MAX_MARKERS = 20;

export type NowSeenMarker = { eventId: string; revisionId: string; happenedAt: string };
export type NowSeenState = { version: 1; streams: Partial<Record<NowArea, NowSeenMarker>>; updatedAt: string | null };

export function emptyNowSeenState(): NowSeenState {
  return { version: 1, streams: {}, updatedAt: null };
}

function marker(value: unknown): NowSeenMarker | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.eventId !== "string" || typeof raw.revisionId !== "string" || typeof raw.happenedAt !== "string") return null;
  if (!raw.eventId || !raw.revisionId || Number.isNaN(Date.parse(raw.happenedAt))) return null;
  return { eventId: raw.eventId.slice(0, 200), revisionId: raw.revisionId.slice(0, 200), happenedAt: raw.happenedAt };
}

export function parseNowSeenState(raw: string | null): NowSeenState {
  if (!raw) return emptyNowSeenState();
  try {
    const input = JSON.parse(raw) as unknown;
    if (!input || typeof input !== "object" || (input as { version?: unknown }).version !== 1) return emptyNowSeenState();
    const streamsInput = (input as { streams?: unknown }).streams;
    if (!streamsInput || typeof streamsInput !== "object") return emptyNowSeenState();
    const streams: NowSeenState["streams"] = {};
    for (const [area, value] of Object.entries(streamsInput).slice(0, MAX_MARKERS)) {
      if (!["news", "weather", "ratings", "riigikogu", "economy", "political-finance"].includes(area)) continue;
      const parsed = marker(value);
      if (parsed) streams[area as NowArea] = parsed;
    }
    return { version: 1, streams, updatedAt: typeof (input as { updatedAt?: unknown }).updatedAt === "string" ? (input as { updatedAt: string }).updatedAt : null };
  } catch { return emptyNowSeenState(); }
}

export function isNowCardNew(state: NowSeenState, card: NowCard): boolean {
  const previous = state.streams[card.area];
  if (!previous) return false;
  if (previous.eventId === card.id && previous.revisionId === card.revisionId) return false;
  return Date.parse(card.happenedAt) >= Date.parse(previous.happenedAt);
}

export function markNowCardsSeen(state: NowSeenState, cards: readonly NowCard[], now = new Date()): NowSeenState {
  const streams = { ...state.streams };
  for (const card of cards) {
    const current = streams[card.area];
    if (!current || card.id === current.eventId || Date.parse(card.happenedAt) >= Date.parse(current.happenedAt)) {
      streams[card.area] = { eventId: card.id, revisionId: card.revisionId, happenedAt: card.happenedAt };
    }
  }
  return { version: 1, streams, updatedAt: now.toISOString() };
}
