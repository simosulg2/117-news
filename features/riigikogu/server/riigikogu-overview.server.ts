import { InProcessSnapshotCache, type SnapshotCacheStatus } from "@/lib/snapshot-cache";
import type {
  RiigikoguAgenda,
  RiigikoguBillSummary,
  RiigikoguFactionSummary,
  RiigikoguOverviewResponse,
  RiigikoguVoteSummary,
} from "@/lib/riigikogu-types";
import { parseRiigikoguAgenda } from "./agenda-parser";
import { parseBillList } from "./bill-parser";
import { parseCurrentFactions } from "./member-parser";
import { parseCurrentMembership } from "./membership-parser";
import { fetchRiigikoguJson } from "./riigikogu-source.server";
import { parseVoteList, parseVoteSummary } from "./vote-parser";

type Cached<T> = { data: T; retrievedAt: string };
type Area = "agenda" | "votes" | "bills" | "members";

const agendaCache = new InProcessSnapshotCache<Cached<RiigikoguAgenda>>(5 * 60_000, 60_000);
const voteCache = new InProcessSnapshotCache<Cached<RiigikoguVoteSummary[]>>(5 * 60_000, 60_000);
const membershipCache = new InProcessSnapshotCache<Cached<number>>(30 * 60_000, 5 * 60_000);
let cachedMembership: number | null = null;
let billCache = createBillCache();
let memberCache = createMemberCache();

function createBillCache() {
  return new InProcessSnapshotCache<Cached<RiigikoguBillSummary[]>>(30 * 60_000, 5 * 60_000);
}

function createMemberCache() {
  return new InProcessSnapshotCache<Cached<RiigikoguFactionSummary[]>>(6 * 60 * 60_000, 15 * 60_000);
}

function cachesForMembership(membership: number) {
  if (cachedMembership !== membership) {
    cachedMembership = membership;
    billCache = createBillCache();
    memberCache = createMemberCache();
  }
  return { bills: billCache, members: memberCache };
}

function tallinnDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isoDateInTallinn(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function weekRange(date: string): { startDate: string; endDate: string } {
  const midday = new Date(`${date}T12:00:00Z`);
  const weekday = midday.getUTCDay() || 7;
  const start = new Date(midday);
  start.setUTCDate(midday.getUTCDate() - weekday + 1);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

async function refreshAgenda(): Promise<Cached<RiigikoguAgenda>> {
  const response = await fetchRiigikoguJson("/api/agenda/plenary", {
    date: tallinnDate(), lang: "ET", querySteno: "false",
  });
  return { data: parseRiigikoguAgenda(response.value), retrievedAt: response.retrievedAt };
}

async function refreshVotes(): Promise<Cached<RiigikoguVoteSummary[]>> {
  const latestResponse = await fetchRiigikoguJson("/api/votings/last", { lang: "ET" });
  const latest = parseVoteSummary(latestResponse.value);
  try {
    const range = weekRange(isoDateInTallinn(latest.startedAt));
    const listResponse = await fetchRiigikoguJson("/api/votings", { ...range, lang: "ET" });
    const list = parseVoteList(listResponse.value);
    return { data: list.length > 0 ? list.slice(0, 12) : [latest], retrievedAt: listResponse.retrievedAt };
  } catch {
    return { data: [latest], retrievedAt: latestResponse.retrievedAt };
  }
}

async function refreshCurrentMembership(): Promise<Cached<number>> {
  const response = await fetchRiigikoguJson("/api/memberships/current");
  return { data: parseCurrentMembership(response.value), retrievedAt: response.retrievedAt };
}

async function refreshBills(membership: number): Promise<Cached<RiigikoguBillSummary[]>> {
  const response = await fetchRiigikoguJson("/api/volumes/drafts", {
    membership: String(membership), proceedingStatus: "IN_PROCESS", lang: "ET",
    page: "0", size: "12", sort: "activeDraftStatusDate,desc",
  });
  return { data: parseBillList(response.value).slice(0, 12), retrievedAt: response.retrievedAt };
}

async function refreshMembers(membership: number): Promise<Cached<RiigikoguFactionSummary[]>> {
  const response = await fetchRiigikoguJson("/api/plenary-members", { membership: String(membership), lang: "ET" });
  return { data: parseCurrentFactions(response.value, membership), retrievedAt: response.retrievedAt };
}

export async function loadRiigikoguOverview(): Promise<RiigikoguOverviewResponse> {
  const membershipResult = await membershipCache.get(refreshCurrentMembership).catch(() => null);
  const membership = membershipResult?.value.data ?? null;
  const termCaches = membership === null ? null : cachesForMembership(membership);
  const membershipUnavailable = () => Promise.reject(new Error("Current Riigikogu membership unavailable"));
  const results = await Promise.allSettled([
    agendaCache.get(refreshAgenda), voteCache.get(refreshVotes),
    membership === null || termCaches === null
      ? membershipUnavailable()
      : termCaches.bills.get(() => refreshBills(membership)),
    membership === null || termCaches === null
      ? membershipUnavailable()
      : termCaches.members.get(() => refreshMembers(membership)),
  ]);
  const areas: Area[] = ["agenda", "votes", "bills", "members"];
  const unavailable = results.flatMap((result, index) => result.status === "rejected" ? [areas[index]] : []);
  if (unavailable.length === areas.length) throw new Error("Every Riigikogu source area failed");
  const value = <T>(index: number): Cached<T> | null => results[index].status === "fulfilled"
    ? results[index].value.value as Cached<T> : null;
  const statuses = results.flatMap((result) => result.status === "fulfilled" ? [result.value.status] : []);
  if (membershipResult) statuses.push(membershipResult.status);
  const retrieved = [
    ...results.flatMap((result) => result.status === "fulfilled" ? [result.value.value.retrievedAt] : []),
    ...(membershipResult ? [membershipResult.value.retrievedAt] : []),
  ].sort();
  return {
    membership,
    state: statuses.includes("stale-if-error" as SnapshotCacheStatus) ? "stale" : unavailable.length ? "partial" : "ok",
    generatedAt: new Date().toISOString(),
    agenda: value<RiigikoguAgenda>(0)?.data ?? null,
    votes: value<RiigikoguVoteSummary[]>(1)?.data ?? [],
    bills: value<RiigikoguBillSummary[]>(2)?.data ?? [],
    factions: value<RiigikoguFactionSummary[]>(3)?.data ?? [],
    unavailable,
    attribution: {
      name: "Riigikogu Kantselei avaandmed",
      sourceUrl: "https://www.riigikogu.ee/avaandmed/",
      licence: "CC BY-SA 3.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      retrievedAt: retrieved.at(-1) ?? new Date().toISOString(),
    },
  };
}
