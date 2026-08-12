"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  RiigikoguSeatMap,
  type RiigikoguProjectedParty,
} from "@/components/riigikogu-seat-map";
import { projectRiigikoguSeats, type SeatProjectionResult } from "@/lib/seat-projection";
import type { RatingsParty, RatingsResponse } from "@/lib/ratings-types";

const RATINGS_REFRESH_MS = 60 * 60 * 1_000;
const RATINGS_REFRESH_CHECK_MS = 5 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const CURRENT_GOVERNMENT_PARTY_IDS = new Set(["reform", "eesti200"]);
const EXCLUDED_FROM_PROJECTION_KINDS = new Set(["independent", "other"]);

const clockFormatter = new Intl.DateTimeFormat("et-EE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const dateFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Tallinn",
});

const dateTimeFormatter = new Intl.DateTimeFormat("et-EE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Tallinn",
});

const numberFormatter = new Intl.NumberFormat("et-EE");
const percentageFormatter = new Intl.NumberFormat("et-EE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type ProjectionParty = RiigikoguProjectedParty & {
  change: number | null;
  previousSupport: number | null;
};

function percentage(value: number | null): string {
  return value === null ? "—" : `${percentageFormatter.format(value)}%`;
}

function signedChange(value: number | null): string {
  if (value === null) return "—";
  if (Math.abs(value) < 0.05) return "0,0";
  return `${value > 0 ? "+" : "−"}${percentageFormatter.format(Math.abs(value))}`;
}

function relativeAge(value: string, nowMs: number): string {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T12:00:00Z`)
    : Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const elapsedMinutes = Math.max(0, Math.floor((nowMs - time) / 60_000));
  if (elapsedMinutes < 1) return "praegu";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min tagasi`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} t tagasi`;
  return `${Math.floor(hours / 24)} p tagasi`;
}

function electionParty(party: RatingsParty): party is RatingsParty & { supportPct: number } {
  return party.supportPct !== null && !EXCLUDED_FROM_PROJECTION_KINDS.has(party.kind);
}

function coalitionLabel(seats: number): string {
  const difference = seats - 51;
  if (difference === 0) return "täpselt enamus";
  if (difference > 0) return `enamus +${difference}`;
  return `enamusest ${Math.abs(difference)} puudu`;
}

function LoadingState() {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.75fr)]" aria-label="Laadin reitinguid">
      <div className="h-[31rem] border border-[#9fb2c0] bg-[#f4f7f9] p-4 dark:border-[#35536a] dark:bg-[#0a1926]">
        <div className="skeleton h-5 w-52" />
        <div className="skeleton mx-auto mt-16 h-56 w-4/5" />
      </div>
      <div className="space-y-3">
        <div className="h-32 border border-[#9fb2c0] bg-[#f4f7f9] p-4 dark:border-[#35536a] dark:bg-[#0a1926]">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton mt-5 h-12 w-36" />
        </div>
        <div className="h-80 border border-[#9fb2c0] bg-[#f4f7f9] p-4 dark:border-[#35536a] dark:bg-[#0a1926]">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton mt-5 h-56 w-full" />
        </div>
      </div>
    </div>
  );
}

export function RatingsPortal() {
  const [data, setData] = useState<RatingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [now, setNow] = useState<Date | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [showMinorParties, setShowMinorParties] = useState(false);
  const [selectedCoalitionIds, setSelectedCoalitionIds] = useState<Set<string>>(new Set());
  const dataRef = useRef<RatingsResponse | null>(null);
  const fetchedAtRef = useRef(0);
  const forceRefreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let activeController: AbortController | null = null;

    async function loadRatings(force = false) {
      if (inFlight) return;
      if (!force && fetchedAtRef.current > 0 && Date.now() - fetchedAtRef.current < RATINGS_REFRESH_MS) return;

      inFlight = true;
      const controller = new AbortController();
      activeController = controller;
      if (dataRef.current) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setError(null);
      }

      try {
        const response = await fetch("/api/ratings", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Reitingute laadimine ebaõnnestus.");
        const servedStale = response.headers.get("X-Ratings-Snapshot") === "stale-if-error";
        const nextData = (await response.json()) as RatingsResponse;
        if (disposed) return;
        dataRef.current = nextData;
        fetchedAtRef.current = Date.parse(nextData.fetchedAt) || Date.now();
        setData(nextData);
        setError(null);
        setRefreshError(servedStale ? "Allika uuendamine ebaõnnestus; kuvame viimati õnnestunud seisu." : null);
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        if (disposed) return;
        if (dataRef.current) {
          setRefreshError("Värskendus ebaõnnestus; kuvame viimati laaditud reitinguid.");
        } else {
          setError("Reitingute allikaga ei saadud ühendust. Kontrolli ühendust ja proovi uuesti.");
        }
      } finally {
        if (activeController === controller) activeController = null;
        inFlight = false;
        if (!disposed && !controller.signal.aborted) setRefreshing(false);
      }
    }

    forceRefreshRef.current = () => void loadRatings(true);
    void loadRatings(true);
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void loadRatings();
    };
    const interval = window.setInterval(refreshWhenActive, RATINGS_REFRESH_CHECK_MS);
    document.addEventListener("visibilitychange", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);

    return () => {
      disposed = true;
      forceRefreshRef.current = null;
      activeController?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, [retryKey]);

  const projection = useMemo<SeatProjectionResult | null>(() => {
    if (!data) return null;
    const parties = data.poll.parties.filter(electionParty).map((party) => ({
      id: party.id,
      name: party.name,
      support: party.supportPct,
    }));
    try {
      return projectRiigikoguSeats(parties);
    } catch {
      return null;
    }
  }, [data]);

  const projectedParties = useMemo<ProjectionParty[]>(() => {
    if (!data || !projection) return [];
    const pollById = new Map(data.poll.parties.map((party) => [party.id, party]));
    return projection.projection.map((party) => {
      const pollParty = pollById.get(party.id);
      return {
        id: party.id,
        name: party.name,
        shortName: pollParty?.shortName ?? party.name,
        color: pollParty?.color ?? "#64748B",
        seats: party.seats,
        support: party.support,
        change: pollParty?.changePctPoints ?? null,
        previousSupport: pollParty?.previousSupportPct ?? null,
      };
    });
  }, [data, projection]);

  const hemicycleParties = useMemo(() => {
    return [...projectedParties].sort((left, right) =>
      right.seats - left.seats
      || right.support - left.support
      || left.name.localeCompare(right.name, "et"));
  }, [projectedParties]);

  const governmentSeats = projectedParties
    .filter((party) => CURRENT_GOVERNMENT_PARTY_IDS.has(party.id))
    .reduce((total, party) => total + party.seats, 0);
  const oppositionSeats = projectedParties
    .filter((party) => !CURRENT_GOVERNMENT_PARTY_IDS.has(party.id))
    .reduce((total, party) => total + party.seats, 0);
  const eesti200Support = data?.poll.parties.find((party) => party.id === "eesti200")?.supportPct ?? null;
  const selectedCoalitionSeats = projectedParties
    .filter((party) => selectedCoalitionIds.has(party.id))
    .reduce((total, party) => total + party.seats, 0);
  const selectedCoalitionCount = projectedParties
    .filter((party) => selectedCoalitionIds.has(party.id))
    .length;
  const chamberParties = useMemo(() => {
    if (selectedCoalitionIds.size === 0) return hemicycleParties;
    return [
      ...hemicycleParties.filter((party) => selectedCoalitionIds.has(party.id)),
      ...hemicycleParties.filter((party) => !selectedCoalitionIds.has(party.id)),
    ];
  }, [hemicycleParties, selectedCoalitionIds]);
  const tableParties = data
    ? data.poll.parties.filter((party) => party.kind === "party" && party.supportPct !== null)
    : [];
  const primaryTableParties = tableParties.filter((party) =>
    (party.supportPct ?? 0) >= 5 || CURRENT_GOVERNMENT_PARTY_IDS.has(party.id));
  const minorTableParties = tableParties.filter((party) =>
    (party.supportPct ?? 0) < 5 && !CURRENT_GOVERNMENT_PARTY_IDS.has(party.id));
  const thresholdWaste = data
    ? data.poll.parties
      .filter((party) => party.kind !== "independent" && party.supportPct !== null && party.supportPct < 5)
      .reduce((total, party) => total + (party.supportPct ?? 0), 0)
    : 0;
  const nowMs = now?.getTime() ?? Date.now();
  const pollEndDate = data ? new Date(`${data.poll.wave.endDate}T12:00:00Z`) : null;
  const pollEndMs = pollEndDate?.getTime() ?? Number.NaN;
  const pollIsOld = Number.isFinite(pollEndMs) && nowMs - pollEndMs > 21 * DAY_MS;

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("117-theme", next);
      } catch {
        // Theme switching remains available when storage is unavailable.
      }
      return next;
    });
  }, []);

  const toggleCoalitionParty = useCallback((id: string) => {
    setSelectedCoalitionIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const projectedIds = new Set(projectedParties.map((party) => party.id));
    setSelectedCoalitionIds((current) => {
      const next = new Set([...current].filter((id) => projectedIds.has(id)));
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
      return next;
    });
  }, [projectedParties]);

  return (
    <div className="min-h-screen">
      <a
        href="#ratings-main"
        className="fixed left-3 top-3 z-[60] -translate-y-20 bg-signal px-3 py-2 text-xs font-semibold text-[#07131f] outline-none focus:translate-y-0 focus:ring-2 focus:ring-white"
      >
        Liigu reitingute juurde
      </a>

      <header className="sticky top-0 z-50 border-b border-[#172b3b] bg-[#08131f] text-[#e8f0f6] shadow-[0_1px_0_#4f8cff]">
        <div className="mx-auto max-w-[96rem] px-3 sm:px-5 lg:px-7">
          <div className="flex min-h-12 items-center justify-between gap-2 border-b border-[#263d50] sm:gap-4">
            <div className="flex min-w-0 self-stretch">
              <a href="/" className="flex items-center gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-signal" aria-label="117.ee avaleht">
                <span className="block size-10 shrink-0" aria-hidden="true">
                  <img src="/117.png" alt="" className="size-full object-contain" />
                </span>
                <span className="hidden text-[13px] font-medium text-[#8da1b0] lg:inline">Eesti reitingulaud</span>
              </a>

              <nav aria-label="Põhinavigatsioon" className="ml-2 flex border-l border-[#263d50] sm:ml-4">
                <a href="/" className="flex min-h-12 items-center border-r border-[#263d50] px-3 text-xs font-semibold text-[#a9b7c2] outline-none hover:bg-[#102538] hover:text-white focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4">
                  Uudised
                </a>
                <a href="/ilm" className="flex min-h-12 items-center border-r border-[#263d50] px-3 text-xs font-semibold text-[#a9b7c2] outline-none hover:bg-[#102538] hover:text-white focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4">
                  Ilm
                </a>
                <a href="/reitingud" aria-current="page" className="flex min-h-12 items-center border-r border-[#263d50] bg-[#102538] px-2 text-xs font-bold text-signal outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-signal sm:px-4">
                  <span className="sm:hidden">Reit.</span>
                  <span className="hidden sm:inline">Reitingud</span>
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="hidden text-[#8da1b0] sm:inline">
                <b className={data ? "text-[#55d6b2]" : "text-[#b6a3ff]"}>{data ? "1/1 allikas" : "—/1 allikas"}</b>
                <span aria-hidden="true" className="ml-3 tabular-nums text-[#8295a4]">{now ? `${clockFormatter.format(now)} Eesti` : "--:--:-- Eesti"}</span>
              </span>
              <button type="button" onClick={toggleTheme} className="min-h-8 border border-[#3b5870] px-2.5 font-bold text-[#c7d5df] outline-none hover:border-signal hover:text-[#7db0ff] focus-visible:ring-1 focus-visible:ring-signal" aria-label={theme === "dark" ? "Kasuta heledat kujundust" : "Kasuta tumedat kujundust"}>
                {theme === "dark" ? "Hele" : "Tume"}
              </button>
            </div>
          </div>

          <div className="flex min-h-8 items-center justify-between gap-3 border-x border-[#263d50] px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7890a2]">
            <span>Norstat · 4 nädala koond</span>
            <span className="sm:hidden" aria-live="polite">{data ? "1/1 allikas" : "—/1 allikas"}</span>
            <span className="hidden tabular-nums sm:inline">5% künnis · 101 kohta · enamus 51</span>
          </div>
        </div>
      </header>

      <main id="ratings-main" tabIndex={-1} className="mx-auto max-w-[96rem] px-3 pb-12 pt-4 outline-none sm:px-5 lg:px-7">
        <div className="mb-3 grid gap-2 border-y border-[#9fb2c0] bg-[#dfe8ee] px-2 py-2 text-xs font-semibold text-[#2d4353] dark:border-[#35536a] dark:bg-[#0d2030] dark:text-[#a9b7c2] sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h1 className="font-bold text-[#245fae] dark:text-signal">Riigikogu reitingulaud</h1>
            <span>Erakondade toetus · kohtade projektsioon</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
            <span aria-live="polite" className={pollIsOld ? "text-[#805818] dark:text-[#efb860]" : ""}>
              {refreshing
                ? "Värskendan…"
                : data
                  ? `${pollIsOld ? "Andmed vananenud · " : ""}periood lõppes ${relativeAge(data.poll.wave.endDate, nowMs)}`
                  : "Andmeid laaditakse"}
            </span>
            <button type="button" onClick={() => forceRefreshRef.current?.()} disabled={refreshing || (!data && !error)} className="font-semibold text-[#4b6170] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal disabled:cursor-wait disabled:no-underline disabled:opacity-60 dark:text-[#8da1b0] dark:hover:text-[#7db0ff]">
              Uuenda
            </button>
          </div>
        </div>

        {refreshError && (
          <div role="status" className="mb-3 border border-[#9d762f] bg-[#d68b20]/5 px-3 py-2 text-xs leading-5 text-[#805818] dark:border-[#8f6728] dark:text-[#efb860]">
            <b>Värskendus hilineb:</b> {refreshError}
          </div>
        )}

        {error && (
          <div role="alert" className="mb-3 flex flex-col gap-3 border border-[#9d2f2f] bg-[#b42318]/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#b42318] dark:text-[#ff6b63]">Reitingute laadimine ebaõnnestus</p>
              <p className="mt-1 text-xs leading-5 text-[#526878] dark:text-[#8da1b0]">{error}</p>
            </div>
            <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]">
              Proovi uuesti
            </button>
          </div>
        )}

        {!data && !error && <LoadingState />}

        {data && !projection && (
          <div role="alert" className="mb-3 border border-[#9d2f2f] bg-[#b42318]/5 px-3 py-3 text-sm text-[#b42318] dark:text-[#ff6b63]">
            <b>Kohtade projektsiooni ei saanud arvutada.</b> Küsitluse andmed laaditi, kuid ükski erakond ei vastanud mudeli tingimustele.
          </div>
        )}

        {data && projection && (
          <>
            <section aria-labelledby="projection-heading" className="grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.72fr)]">
              <h2 id="projection-heading" className="sr-only">Riigikogu kohtade projektsioon</h2>
              <RiigikoguSeatMap
                parties={chamberParties}
                selectedPartyIds={selectedCoalitionIds}
                selectedSeatCount={selectedCoalitionSeats}
              />

              <div className="grid content-start gap-3">
                <section aria-labelledby="government-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
                  <div className="border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
                    <h2 id="government-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Valitsus vs ülejäänud</h2>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#bdcad3] dark:divide-[#294154]">
                    <div className="px-3 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#607583] dark:text-[#7890a2]">REF + E200</p>
                      <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-[#245fae] dark:text-[#7db0ff]">{governmentSeats}</p>
                      <p className="mt-2 text-xs font-semibold text-[#805818] dark:text-[#efb860]">{coalitionLabel(governmentSeats)}</p>
                    </div>
                    <div className="px-3 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#607583] dark:text-[#7890a2]">Ülejäänud</p>
                      <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-[#334957] dark:text-[#dce7ee]">{oppositionSeats}</p>
                      <p className="mt-2 text-xs text-[#526878] dark:text-[#8da1b0]">projektsioonis</p>
                    </div>
                  </div>
                  <div className="border-t border-[#bdcad3] px-3 py-2 text-[11px] leading-5 text-[#526878] dark:border-[#294154] dark:text-[#8da1b0]">
                    Valitsusliit: Reformierakond ja Eesti 200. {eesti200Support === null
                      ? "Eesti 200 reiting puudub praegusest küsitlusest."
                      : eesti200Support < 5
                        ? "Eesti 200 jääb praeguses küsitluses alla valimiskünnise."
                        : "Mõlemad erakonnad ületavad praeguses küsitluses valimiskünnise."}
                  </div>
                </section>

                <section aria-labelledby="coalition-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
                  <div className="flex items-center justify-between gap-3 border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
                    <h2 id="coalition-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Koalitsioonilabor</h2>
                    <div className="flex items-center gap-3">
                      {selectedCoalitionCount > 0 && (
                        <button type="button" onClick={() => setSelectedCoalitionIds(new Set())} className="text-[11px] font-semibold text-[#526878] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#8da1b0] dark:hover:text-[#7db0ff]">
                          Tühjenda
                        </button>
                      )}
                      <span className={`text-xs font-bold tabular-nums ${selectedCoalitionSeats >= 51 ? "text-[#087663] dark:text-[#55d6b2]" : "text-[#526878] dark:text-[#8da1b0]"}`}>
                        {selectedCoalitionSeats}/101
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-px bg-[#d0dbe2] p-px dark:bg-[#24394a]">
                    {hemicycleParties.map((party) => {
                      const selected = selectedCoalitionIds.has(party.id);
                      return (
                        <button key={party.id} type="button" onClick={() => toggleCoalitionParty(party.id)} aria-pressed={selected} className={`grid min-h-11 grid-cols-[auto_auto_1fr_auto] items-center gap-2 border-l-2 px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${selected ? "border-[#087663] bg-[#087663]/10 dark:border-[#55d6b2]" : "border-transparent bg-[#f8fafb] hover:bg-[#edf3f7] dark:bg-[#0d2030] dark:hover:bg-[#102538]"}`}>
                          <span aria-hidden="true" className={`grid size-4 place-items-center border text-[10px] font-black ${selected ? "border-[#087663] bg-[#087663] text-white dark:border-[#55d6b2] dark:bg-[#55d6b2] dark:text-[#07131f]" : "border-[#9fb2c0] text-transparent dark:border-[#58768b]"}`}>✓</span>
                          <span className="size-2.5 border border-[#263946]/70 dark:border-[#d8e4eb]/80" style={{ backgroundColor: party.color }} aria-hidden="true" />
                          <span className="truncate font-semibold text-[#304654] dark:text-[#c2d0d9]">{party.shortName}</span>
                          <b className="tabular-nums text-[#192630] dark:text-[#e5eef4]">{party.seats}</b>
                        </button>
                      );
                    })}
                  </div>
                  <div aria-live="polite" className={`border-t px-3 py-2 text-xs font-semibold ${selectedCoalitionSeats >= 51 ? "border-[#58a895] bg-[#087663]/5 text-[#087663] dark:border-[#2b7b69] dark:text-[#55d6b2]" : "border-[#bdcad3] text-[#526878] dark:border-[#294154] dark:text-[#8da1b0]"}`}>
                    {selectedCoalitionCount === 0 ? "Vali erakonnad, et proovida enamust." : `${selectedCoalitionSeats} kohta · ${coalitionLabel(selectedCoalitionSeats)}`}
                  </div>
                </section>

                <section aria-labelledby="poll-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
                  <div className="border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
                    <h2 id="poll-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Küsitluse info</h2>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-3 py-3 text-[11px] leading-5">
                    <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Periood</dt>
                    <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">{dateFormatter.format(new Date(`${data.poll.wave.startDate}T12:00:00Z`))}–{dateFormatter.format(new Date(`${data.poll.wave.endDate}T12:00:00Z`))}</dd>
                    <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Valim</dt>
                    <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">kokku n={data.poll.sample.total === null ? "—" : numberFormatter.format(data.poll.sample.total)}</dd>
                    <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Reitingu alus</dt>
                    <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">eelistusega n={data.poll.sample.voters === null ? "—" : numberFormatter.format(data.poll.sample.voters)}</dd>
                    <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Eelistuseta</dt>
                    <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">{percentage(data.poll.withoutPartyPreferencePct)}</dd>
                    <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Alla künnise</dt>
                    <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">{percentage(thresholdWaste)}</dd>
                  </dl>
                </section>
              </div>
            </section>

            <section aria-labelledby="party-table-heading" className="mt-3 overflow-hidden border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
              <div className="grid gap-2 border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <h2 id="party-table-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Erakondade seis</h2>
                  <p className="mt-0.5 text-[11px] text-[#526878] dark:text-[#8da1b0]">
                    Põhivaates on künnise ületajad ja valitsuserakonnad. Muutus eelmise nädala 4 nädala koondiga
                    {data.poll.previousWave ? ` (${dateFormatter.format(new Date(`${data.poll.previousWave.startDate}T12:00:00Z`))}–${dateFormatter.format(new Date(`${data.poll.previousWave.endDate}T12:00:00Z`))})` : ""} · pp
                  </p>
                </div>
                {minorTableParties.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={showMinorParties}
                    aria-controls="minor-party-rows"
                    onClick={() => setShowMinorParties((current) => !current)}
                    className="min-h-9 border border-[#718896] bg-[#edf2f5] px-3 text-xs font-bold text-[#405767] outline-none hover:border-[#245fae] hover:text-[#245fae] focus-visible:ring-2 focus-visible:ring-signal dark:border-[#58768b] dark:bg-[#102538] dark:text-[#a9b7c2] dark:hover:text-[#7db0ff]"
                  >
                    {showMinorParties ? "Peida" : "Näita"} väiksemaid ({minorTableParties.length})
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] border-collapse text-xs">
                  <thead className="bg-[#edf2f5] text-left text-[10px] font-bold uppercase tracking-[0.07em] text-[#607583] dark:bg-[#0d2030] dark:text-[#7890a2]">
                    <tr>
                      <th scope="col" className="px-3 py-2">Erakond</th>
                      <th scope="col" className="px-3 py-2 text-right">Toetus</th>
                      <th scope="col" className="px-3 py-2 text-right">Muutus</th>
                      <th scope="col" className="px-3 py-2 text-right">Kohad</th>
                      <th scope="col" className="px-3 py-2">Staatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {primaryTableParties.map((party) => {
                      const projected = projectedParties.find((candidate) => candidate.id === party.id);
                      const passes = (party.supportPct ?? 0) >= 5;
                      const currentRole = CURRENT_GOVERNMENT_PARTY_IDS.has(party.id) ? "Valitsus · " : "";
                      const status = `${currentRole}${passes ? "saaks kohti" : "alla 5%"}`;
                      return (
                        <tr key={party.id} className="border-t border-[#d0dbe2] text-[#304654] dark:border-[#24394a] dark:text-[#c2d0d9]">
                          <th scope="row" className="px-3 py-2 text-left font-semibold">
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 shrink-0 border border-[#07131f]/50 dark:border-white/70" style={{ backgroundColor: party.color }} aria-hidden="true" />
                              <span>{party.name}</span>
                            </span>
                          </th>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-[#192630] dark:text-[#e5eef4]">{percentage(party.supportPct)}</td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${party.changePctPoints !== null && party.changePctPoints > 0 ? "text-[#087663] dark:text-[#55d6b2]" : party.changePctPoints !== null && party.changePctPoints < 0 ? "text-[#9d2733] dark:text-[#ff929d]" : "text-[#607583] dark:text-[#8da1b0]"}`}>
                            {signedChange(party.changePctPoints)}
                          </td>
                          <td className="px-3 py-2 text-right text-lg font-bold tabular-nums text-[#245fae] dark:text-[#7db0ff]">{projected?.seats ?? 0}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex border-l-2 pl-2 font-semibold ${passes ? "border-[#245fae] text-[#405767] dark:border-signal dark:text-[#a9b7c2]" : "border-[#9d762f] text-[#805818] dark:border-[#efb860] dark:text-[#efb860]"}`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tbody id="minor-party-rows" hidden={!showMinorParties}>
                    {minorTableParties.map((party) => {
                      const projected = projectedParties.find((candidate) => candidate.id === party.id);
                      const passes = (party.supportPct ?? 0) >= 5;
                      const status = passes ? "saaks kohti" : "alla 5%";
                      return (
                        <tr key={party.id} className="border-t border-[#d0dbe2] text-[#304654] dark:border-[#24394a] dark:text-[#c2d0d9]">
                          <th scope="row" className="px-3 py-2 text-left font-semibold">
                            <span className="flex items-center gap-2">
                              <span className="size-2.5 shrink-0 border border-[#07131f]/50 dark:border-white/70" style={{ backgroundColor: party.color }} aria-hidden="true" />
                              <span>{party.name}</span>
                            </span>
                          </th>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-[#192630] dark:text-[#e5eef4]">{percentage(party.supportPct)}</td>
                          <td className={`px-3 py-2 text-right font-semibold tabular-nums ${party.changePctPoints !== null && party.changePctPoints > 0 ? "text-[#087663] dark:text-[#55d6b2]" : party.changePctPoints !== null && party.changePctPoints < 0 ? "text-[#9d2733] dark:text-[#ff929d]" : "text-[#607583] dark:text-[#8da1b0]"}`}>
                            {signedChange(party.changePctPoints)}
                          </td>
                          <td className="px-3 py-2 text-right text-lg font-bold tabular-nums text-[#245fae] dark:text-[#7db0ff]">{projected?.seats ?? 0}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex border-l-2 pl-2 font-semibold ${passes ? "border-[#245fae] text-[#405767] dark:border-signal dark:text-[#a9b7c2]" : "border-[#9d762f] text-[#805818] dark:border-[#efb860] dark:text-[#efb860]"}`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="method-heading" className="mt-3 grid gap-3 border border-[#9fb2c0] bg-[#f4f7f9] p-3 text-xs leading-5 text-[#526878] dark:border-[#35536a] dark:bg-[#0a1926] dark:text-[#8da1b0] md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]">
              <div>
                <h2 id="method-heading" className="font-bold text-[#192630] dark:text-[#e5eef4]">Kuidas projektsioon sünnib?</h2>
                <p className="mt-1">
                  Kohtade hinnang kasutab üleriigilist toetust, 5% valimiskünnist ja Eesti modifitseeritud D’Hondti jagajaid 1, 2<sup>0,9</sup>, 3<sup>0,9</sup> … Täpselt 5% läheb arvesse. Kõik 101 kohta jaotatakse nimega erakondade vahel, mis künnise ületavad; kategooria „muu“ ja üksikkandidaadid mudelis kohti ei saa. Tegemist ei ole ametliku valimistulemuse ega ennustusega: tegelik jaotus sõltub 12 ringkonnast, kandidaatidest ning isiku- ja ringkonnamandaatidest, sealhulgas üksikkandidaadi võimalikust isikumandaadist.
                </p>
              </div>
              <div className="border-t border-[#bdcad3] pt-2 dark:border-[#294154] md:border-l md:border-t-0 md:pl-3 md:pt-0">
                <p><b className="text-[#304654] dark:text-[#c2d0d9]">Allikas:</b> {data.poll.source.label}</p>
                <p><b className="text-[#304654] dark:text-[#c2d0d9]">Loetud:</b> {dateTimeFormatter.format(new Date(data.fetchedAt)).replace(",", "")}</p>
                {data.sourceUpdatedAt && <p><b className="text-[#304654] dark:text-[#c2d0d9]">Allikas uuendatud:</b> {dateTimeFormatter.format(new Date(data.sourceUpdatedAt)).replace(",", "")}</p>}
                <div className="mt-1 flex flex-wrap gap-x-3">
                  <a href={data.poll.source.publisherUrl} target="_blank" rel="noopener noreferrer external" className="font-semibold underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">Reitingud.ee</a>
                  <a href={data.poll.source.documentationUrl} target="_blank" rel="noopener noreferrer external" className="font-semibold underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">Andmed</a>
                  <a href={data.poll.source.methodologyUrl} target="_blank" rel="noopener noreferrer external" className="font-semibold underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">Metoodika</a>
                  <a href="https://www.valimised.ee/et/valimiste-meelespea/tulemuste-kindlakstegemine/valimistulemuste-kindlakstegemine-riigikogu" target="_blank" rel="noopener noreferrer external" className="font-semibold underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]">Ametlik valimiskord</a>
                </div>
                <div className="mt-2 border-t border-[#bdcad3] pt-2 dark:border-[#294154]">
                  <a href="https://emor.ee/erakondade-toetusreitingud/" className="font-bold text-[#405767] underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#a9b7c2] dark:hover:text-[#7db0ff]">
                    Kantar Emori kuureiting →
                  </a>
                  <p className="mt-0.5">Eraldi metoodika; Emori tulemusi ei kasutata siin kohtade projektsioonis.</p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-[#9fb2c0] bg-[#dfe8ee] dark:border-[#35536a] dark:bg-[#0b1b29]">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-2 px-3 py-3 text-[11px] text-[#526878] dark:text-[#7890a2] sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-7">
          <span><b className="text-[#245fae] dark:text-signal">117.ee</b> · Eesti reitingulaud</span>
          <span>Allikas: Ühiskonnauuringute Instituut / Norstat · Projektsioon ei ole valimistulemus</span>
        </div>
      </footer>
    </div>
  );
}
