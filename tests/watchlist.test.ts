import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SEEN_EVENTS, MAX_WATCHES, addWatch, clearWatchHistory, emptyWatchlist, isNewWatchMatch,
  markWatchEventSeen, parseStoredWatchlist, parseWatchlist, parseWatchlistImport, removeWatch,
  watchMatchesEvent, watchTracksEvent, type WatchableEvent,
} from "../features/watchlist/model/watchlist.ts";

const partyEvent: WatchableEvent = {
  id: "rating:isamaa:381", revisionId: "381:26.4", kind: "party-threshold",
  entityIds: ["isamaa"], text: "Isamaa 26.4%", crossedThreshold: true,
};

test("invalid and corrupted storage fails to an empty document", () => {
  assert.deepEqual(parseStoredWatchlist("not json"), emptyWatchlist());
  assert.deepEqual(parseWatchlist({ version: 1, entries: "bad" }), emptyWatchlist());
});

test("version zero migrates, normalizes, and deduplicates watches", () => {
  const migrated = parseWatchlist({ version: 0, watches: [
    { kind: "party-rating", targetId: "isamaa", label: "Isamaa", createdAt: "2026-01-01T00:00:00Z" },
    { kind: "party-rating", targetId: "isamaa", label: "Duplicate", createdAt: "2026-01-02T00:00:00Z" },
  ] });
  assert.equal(migrated.version, 1);
  assert.equal(migrated.entries.length, 1);
});

test("invalid imports are rejected instead of replacing a valid setup", () => {
  assert.equal(parseWatchlistImport('{"version":1,"entries":[{"kind":"made-up"}]}'), null);
  assert.equal(parseWatchlistImport('{"version":9,"entries":[]}'), null);
  assert.deepEqual(parseWatchlistImport('{"version":1,"entries":[],"seenEvents":[]}'), emptyWatchlist());
});

test("adding and removing a watch is stable and bounded", () => {
  let document = emptyWatchlist();
  document = addWatch(document, { kind: "party-rating", targetId: "isamaa", label: "Isamaa" });
  document = addWatch(document, { kind: "party-rating", targetId: "isamaa", label: "Isamaa" });
  assert.equal(document.entries.length, 1);
  document = removeWatch(document, "party-rating", "isamaa");
  for (let index = 0; index < MAX_WATCHES; index += 1) {
    document = addWatch(document, { kind: "news-source", targetId: `source-${index}`, label: `Source ${index}` });
  }
  assert.throws(() => addWatch(document, { kind: "news-source", targetId: "overflow", label: "Overflow" }), /limit/);
});

test("threshold and coalition watches require the matching state transition", () => {
  const threshold = addWatch(emptyWatchlist(), { kind: "party-threshold", targetId: "isamaa", label: "Isamaa 5%" }).entries[0];
  assert.equal(watchMatchesEvent(threshold, partyEvent), true);
  assert.equal(watchMatchesEvent(threshold, { ...partyEvent, crossedThreshold: false }), false);
  const coalition = addWatch(emptyWatchlist(), { kind: "coalition-majority", targetId: "eesti200+reform", label: "Koalitsioon", partyIds: ["reform", "eesti200"] }).entries[0];
  const unchanged = { ...partyEvent, kind: "coalition-majority" as const, entityIds: ["eesti200", "reform"], hasMajority: true };
  assert.equal(watchMatchesEvent(coalition, unchanged), false);
  assert.equal(watchTracksEvent(coalition, unchanged), true);
  assert.equal(watchMatchesEvent(coalition, { ...partyEvent, kind: "coalition-majority", entityIds: ["eesti200", "reform"], hasMajority: true, majorityChanged: true }), true);
});

test("new matches become quiet after the exact revision is seen", () => {
  let document = addWatch(emptyWatchlist(), { kind: "party-threshold", targetId: "isamaa", label: "Isamaa 5%" });
  assert.equal(isNewWatchMatch(document, partyEvent), true);
  document = markWatchEventSeen(document, partyEvent);
  assert.equal(isNewWatchMatch(document, partyEvent), false);
  assert.equal(isNewWatchMatch(document, { ...partyEvent, revisionId: "381:26.5" }), true);
});

test("seen event storage is pruned", () => {
  let document = emptyWatchlist();
  for (let index = 0; index < MAX_SEEN_EVENTS + 20; index += 1) {
    document = markWatchEventSeen(document, { ...partyEvent, id: `event-${index}` }, new Date(1_700_000_000_000 + index));
  }
  assert.equal(document.seenEvents.length, MAX_SEEN_EVENTS);
});

test("history reset preserves watches while clearing novelty markers", () => {
  const watched = addWatch(emptyWatchlist(), { kind: "party-threshold", targetId: "isamaa", label: "Isamaa 5%" });
  const reset = clearWatchHistory(markWatchEventSeen(watched, partyEvent));
  assert.equal(reset.entries.length, 1);
  assert.deepEqual(reset.seenEvents, []);
});
