import { formatScheduleWindow } from "@/features/schedule/model/schedule-events";
import type { ScheduleEvent } from "@/lib/schedule-types";

import { CATEGORY_ACCENTS } from "./schedule-formatters";

type ScheduleCompactEventProps = {
  event: ScheduleEvent;
  state?: "current" | "next";
  past?: boolean;
  showDetail?: boolean;
};

export function ScheduleCompactEvent({
  event,
  state,
  past = false,
  showDetail = false,
}: ScheduleCompactEventProps) {
  return (
    <article
      aria-label={past ? `Möödunud: ${event.title}` : undefined}
      className={`min-w-0 border border-l-4 px-2.5 py-2 ${past
        ? "border-[#c3cbd1] bg-[#edf0f2] grayscale dark:border-[#263946] dark:bg-[#0a151d]"
        : `border-[#bdc9d1] bg-white ${CATEGORY_ACCENTS[event.category]} dark:border-y-[#29485f] dark:border-r-[#29485f] dark:bg-[#0b1b29]`
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className={`shrink-0 tabular-nums text-[10px] font-black ${past ? "text-[#75838c] dark:text-[#748895]" : "text-[#245fae] dark:text-signal"}`}>
          {formatScheduleWindow(event)}
        </p>
        {state && (
          <span className="truncate border border-[#245fae] bg-[#e4eefb] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#174b8d] dark:border-signal dark:bg-[#102b43] dark:text-[#8eb8ff]">
            {state === "current" ? "Praegu" : "Järgmine"}
          </span>
        )}
      </div>
      <h4 className={`mt-0.5 truncate text-[11px] font-black leading-4 ${past ? "text-[#65737c] dark:text-[#82939e]" : "text-[#172634] dark:text-[#edf4f8]"}`} title={event.title}>
        {event.title}
      </h4>
      {showDetail && event.detail && (
        <p className="truncate text-[9px] leading-4 text-[#617786] dark:text-[#8da1b0]" title={event.detail}>
          {event.detail}
        </p>
      )}
    </article>
  );
}
