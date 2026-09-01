import { formatScheduleWindow } from "@/features/schedule/model/schedule-events";
import type { ScheduleEvent } from "@/lib/schedule-types";

import {
  CATEGORY_ACCENTS,
  CATEGORY_LABELS,
} from "./schedule-formatters";

type ScheduleEventCardProps = {
  event: ScheduleEvent;
  state?: "current" | "next";
  compact?: boolean;
  past?: boolean;
};

export function ScheduleEventCard({
  event,
  state,
  compact = false,
  past = false,
}: ScheduleEventCardProps) {
  const Heading = compact ? "h4" : "h3";

  return (
    <article
      aria-label={past ? `Möödunud: ${event.title}` : undefined}
      className={`border border-l-4 ${past
        ? "border-[#c3cbd1] bg-[#edf0f2] grayscale dark:border-[#263946] dark:bg-[#0a151d]"
        : `border-[#bdc9d1] bg-white ${CATEGORY_ACCENTS[event.category]} dark:border-y-[#29485f] dark:border-r-[#29485f] dark:bg-[#0b1b29]`
      } ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`tabular-nums text-[11px] font-black ${past ? "text-[#75838c] dark:text-[#748895]" : "text-[#245fae] dark:text-signal"}`}>
          {formatScheduleWindow(event)}
        </p>
        <div className="flex flex-wrap justify-end gap-1">
          {state && (
            <span className="border border-[#245fae] bg-[#e4eefb] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#174b8d] dark:border-signal dark:bg-[#102b43] dark:text-[#8eb8ff]">
              {state === "current" ? "Praegu" : "Järgmine"}
            </span>
          )}
          <span className="border border-[#c5d0d7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#617786] dark:border-[#35536a] dark:text-[#8da1b0]">
            {CATEGORY_LABELS[event.category]}
          </span>
        </div>
      </div>
      <Heading className={`${compact ? "mt-1 text-xs" : "mt-1.5 text-sm"} font-black leading-snug ${past ? "text-[#65737c] dark:text-[#82939e]" : "text-[#172634] dark:text-[#edf4f8]"}`}>
        {event.title}
      </Heading>
      {event.detail && (
        <p className="mt-1 text-[11px] leading-4 text-[#617786] dark:text-[#8da1b0]">
          {event.detail}
        </p>
      )}
    </article>
  );
}
