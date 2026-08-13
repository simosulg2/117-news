import type { RatingsResponse } from "@/lib/ratings-types";

import { relativeAge } from "./ratings-formatters";

const DAY_MS = 24 * 60 * 60 * 1_000;

type RatingsStatusProps = {
  data: RatingsResponse | null;
  error: string | null;
  refreshError: string | null;
  refreshing: boolean;
  nowMs: number;
  onRefresh: () => void;
  onRetry: () => void;
};

export function RatingsStatus({
  data,
  error,
  refreshError,
  refreshing,
  nowMs,
  onRefresh,
  onRetry,
}: RatingsStatusProps) {
  const pollEndMs = data ? Date.parse(`${data.poll.wave.endDate}T12:00:00Z`) : Number.NaN;
  const pollIsOld = Number.isFinite(pollEndMs) && nowMs - pollEndMs > 21 * DAY_MS;

  return (
    <>
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
          <button type="button" onClick={onRefresh} disabled={refreshing || (!data && !error)} className="font-semibold text-[#4b6170] underline decoration-[#8194a1] underline-offset-2 outline-none hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal disabled:cursor-wait disabled:no-underline disabled:opacity-60 dark:text-[#8da1b0] dark:hover:text-[#7db0ff]">
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
          <button type="button" onClick={onRetry} className="min-h-10 w-fit border border-[#9d2f2f] px-4 text-xs font-semibold text-[#b42318] outline-none hover:bg-[#b42318] hover:text-white focus-visible:ring-2 focus-visible:ring-[#d9473f] dark:text-[#ff6b63]">
            Proovi uuesti
          </button>
        </div>
      )}
    </>
  );
}

export function RatingsLoadingState() {
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

export function ProjectionUnavailable() {
  return (
    <div role="alert" className="mb-3 border border-[#9d2f2f] bg-[#b42318]/5 px-3 py-3 text-sm text-[#b42318] dark:text-[#ff6b63]">
      <b>Kohtade projektsiooni ei saanud arvutada.</b> Küsitluse andmed laaditi, kuid ükski erakond ei vastanud mudeli tingimustele.
    </div>
  );
}
