import { InProcessSnapshotCache } from "@/lib/snapshot-cache";
import type { RiigikoguBillDetail, RiigikoguVoteDetail } from "@/lib/riigikogu-types";
import { parseBillDetail } from "./bill-parser";
import { isUuid } from "./riigikogu-parser";
import { fetchRiigikoguJson } from "./riigikogu-source.server";
import { parseVoteDetail } from "./vote-detail-parser";

const voteCaches = new Map<string, InProcessSnapshotCache<RiigikoguVoteDetail>>();
const billCaches = new Map<string, InProcessSnapshotCache<RiigikoguBillDetail>>();
const MAXIMUM_DETAIL_CACHES = 32;

export class InvalidRiigikoguIdError extends Error {
  constructor(kind: "vote" | "bill") {
    super(`Invalid ${kind} UUID`);
    this.name = "InvalidRiigikoguIdError";
  }
}

function detailCache<T>(map: Map<string, InProcessSnapshotCache<T>>, id: string): InProcessSnapshotCache<T> {
  const existing = map.get(id);
  if (existing) return existing;
  if (map.size >= MAXIMUM_DETAIL_CACHES) map.delete(map.keys().next().value!);
  const cache = new InProcessSnapshotCache<T>(30 * 60_000, 2 * 60_000);
  map.set(id, cache);
  return cache;
}

export async function loadRiigikoguVote(id: string): Promise<RiigikoguVoteDetail> {
  if (!isUuid(id)) throw new InvalidRiigikoguIdError("vote");
  const result = await detailCache(voteCaches, id).get(async () => {
    const response = await fetchRiigikoguJson(`/api/votings/${id}`, { lang: "ET" });
    return parseVoteDetail(response.value, response.retrievedAt);
  });
  return result.value;
}

export async function loadRiigikoguBill(id: string): Promise<RiigikoguBillDetail> {
  if (!isUuid(id)) throw new InvalidRiigikoguIdError("bill");
  const result = await detailCache(billCaches, id).get(async () => {
    const response = await fetchRiigikoguJson(`/api/volumes/drafts/${id}`, { lang: "ET", querySteno: "false" });
    return parseBillDetail(response.value, response.retrievedAt);
  });
  return result.value;
}
