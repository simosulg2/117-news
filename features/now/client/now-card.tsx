import { WatchToggle } from "@/features/watchlist/client/watch-toggle";
import type { NowCard as NowCardType } from "@/lib/now-types";

const dateFormatter = new Intl.DateTimeFormat("et-EE", {
  timeZone: "Europe/Tallinn", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

const AREA_LABELS: Record<NowCardType["area"], string> = {
  news: "Uudised", weather: "Ilm", ratings: "Reitingud", riigikogu: "Riigikogu",
  economy: "Majandus", "political-finance": "Erakonnaraha",
};

export function NowCard({ card, isNew, newWatchMatch, isRead = false }: { card: NowCardType; isNew: boolean; newWatchMatch: boolean; isRead?: boolean }) {
  return (
    <article className={`relative border bg-[#f8fafb] p-3 dark:bg-[#0a1926] ${isRead ? "opacity-70" : ""} ${isNew || newWatchMatch ? "border-[#4f8cff] shadow-[inset_3px_0_0_#4f8cff]" : "border-[#9fb2c0] dark:border-[#35536a]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.07em] text-[#607583] dark:text-[#7890a2]">
        <span>{AREA_LABELS[card.area]}</span>
        <div className="flex items-center gap-2">
          {newWatchMatch && <span className="text-[#245fae] dark:text-[#7db0ff]">Uus jälgitav vaste</span>}
          {!newWatchMatch && isNew && <span className="text-[#245fae] dark:text-[#7db0ff]">Uus</span>}
          {isRead && <span>Loetud</span>}
          <time dateTime={card.happenedAt} className="tabular-nums">{dateFormatter.format(new Date(card.happenedAt))}</time>
        </div>
      </div>
      <h3 className="mt-2 text-base font-bold leading-snug text-[#192630] dark:text-[#e5eef4]">{card.headline}</h3>
      <p className="mt-1 text-xs leading-5 text-[#405767] dark:text-[#a9b7c2]">{card.detail}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#d0dbe2] pt-2 dark:border-[#24394a]">
        <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
          <a href={card.targetUrl} className="text-[#245fae] underline underline-offset-2 hover:text-[#174b91] dark:text-[#7db0ff]">Ava töölaud →</a>
          <a href={card.sourceUrl} target="_blank" rel="noreferrer" className="text-[#526878] underline underline-offset-2 hover:text-[#245fae] dark:text-[#8da1b0] dark:hover:text-[#7db0ff]">{card.sourceLabel} ↗<span className="sr-only">, avaneb uuel vahelehel</span></a>
        </div>
        {card.watchTarget && <WatchToggle {...card.watchTarget} compact />}
      </div>
    </article>
  );
}
