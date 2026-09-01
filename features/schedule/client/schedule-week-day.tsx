import {
  formatScheduleWindow,
  isScheduleEventPast,
  sortScheduleEvents,
  type TallinnSchedulePosition,
} from "@/features/schedule/model/schedule-events";
import { isDerivedSchoolPeriodEvent } from "@/features/schedule/model/schedule-derived-events";
import type { ScheduleDay, ScheduleEvent } from "@/lib/schedule-types";

import { ScheduleEventCard } from "./schedule-event-card";
import { CATEGORY_ACCENTS, SCHEDULE_DAYS } from "./schedule-formatters";

export function displayEventSummary(events: readonly ScheduleEvent[]): string {
  const hasSchool = events.some(isDerivedSchoolPeriodEvent);
  if (hasSchool) return "Koolipäev";
  const count = events.length;
  return count ? `${count} ${count === 1 ? "plokk" : "plokki"}` : "Vaba päev";
}

function DesktopWeekEvent({
  event,
  current,
  next,
  past,
}: {
  event: ScheduleEvent;
  current: boolean;
  next: boolean;
  past: boolean;
}) {
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
        {(current || next) && (
          <span className="truncate border border-[#245fae] bg-[#e4eefb] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.06em] text-[#174b8d] dark:border-signal dark:bg-[#102b43] dark:text-[#8eb8ff]">
            {current ? "Praegu" : "Järgmine"}
          </span>
        )}
      </div>
      <h4 className={`mt-0.5 truncate text-[11px] font-black leading-4 ${past ? "text-[#65737c] dark:text-[#82939e]" : "text-[#172634] dark:text-[#edf4f8]"}`} title={event.title}>
        {event.title}
      </h4>
      {event.detail && event.category === "school" && (
        <p className="truncate text-[9px] leading-4 text-[#617786] dark:text-[#8da1b0]" title={event.detail}>
          {event.detail}
        </p>
      )}
    </article>
  );
}

export function DayEvents({
  events,
  position,
  currentId,
  nextId,
  collapsePast,
  desktopCompact,
}: {
  events: readonly ScheduleEvent[];
  position: TallinnSchedulePosition | null;
  currentId?: string;
  nextId?: string;
  collapsePast?: boolean;
  desktopCompact?: boolean;
}) {
  if (!events.length) {
    return <p className="p-3 text-[11px] text-[#526878] dark:text-[#7890a2]">Vaba päev</p>;
  }

  const schoolEvents = events.filter(isDerivedSchoolPeriodEvent);
  const classEvents = schoolEvents.filter((event) => event.category === "school");
  const subjectCounts = new Map<string, number>();
  for (const event of classEvents) {
    subjectCounts.set(event.title, (subjectCounts.get(event.title) ?? 0) + 1);
  }
  const schoolSummary: ScheduleEvent | null = schoolEvents.length && classEvents.length
    ? {
        id: `school-summary-${classEvents[0].day}`,
        day: classEvents[0].day,
        startMinute: Math.min(...schoolEvents.map((event) => event.startMinute ?? 1_439)),
        endMinute: Math.max(...schoolEvents.map((event) => event.endMinute ?? 0)),
        title: "Kool",
        detail: [...subjectCounts]
          .map(([subject, count]) => count > 1 ? `${subject} ×${count}` : subject)
          .join(" · "),
        category: "school",
      }
    : null;
  const summarizedSchoolIds = new Set(
    schoolSummary ? schoolEvents.map((event) => event.id) : [],
  );
  const displayEvents = sortScheduleEvents([
    ...events.filter((event) => !summarizedSchoolIds.has(event.id)),
    ...(schoolSummary ? [schoolSummary] : []),
  ]);
  const schoolIds = new Set(schoolEvents.map((event) => event.id));
  const displayItems = displayEvents.map((event) => {
    const summarizedSchool = event.id.startsWith("school-summary-");
    const current = summarizedSchool ? schoolIds.has(currentId ?? "") : event.id === currentId;
    const next = summarizedSchool ? schoolIds.has(nextId ?? "") : event.id === nextId;
    const past = Boolean(
      position
      && !current
      && !next
      && (event.day < position.day
        || (event.day === position.day && isScheduleEventPast(event, position.minuteOfDay))),
    );
    return { event, current, next, past };
  });
  const pastItems = displayItems.filter((item) => item.past);
  const remainingItems = displayItems.filter((item) => !item.past);

  const cards = (items: typeof displayItems) => items.map(({ event, current, next, past }) => desktopCompact
    ? (
        <DesktopWeekEvent
          key={event.id}
          event={event}
          current={current}
          next={next}
          past={past}
        />
      )
    : (
        <ScheduleEventCard
          key={event.id}
          event={event}
          compact
          past={past}
          state={current ? "current" : next ? "next" : undefined}
        />
      ));

  return (
    <div className={desktopCompact ? "grid grid-cols-2 gap-1.5 p-2 lg:grid-cols-4 xl:grid-cols-6" : "grid gap-2 p-2"}>
      {collapsePast && pastItems.length > 0 && (
        <details className={`group border border-[#c3cbd1] bg-[#e3e6e8] dark:border-[#263946] dark:bg-[#0a151d] ${desktopCompact ? "col-span-full" : ""}`}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-2.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#65737c] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#82939e]">
            <span>Möödunud · {pastItems.length}</span>
            <span aria-hidden="true" className="text-base transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className={`grid border-t border-[#c3cbd1] p-2 dark:border-[#263946] ${desktopCompact ? "grid-cols-2 gap-1.5 lg:grid-cols-4 xl:grid-cols-6" : "gap-2"}`}>
            {cards(pastItems)}
          </div>
        </details>
      )}
      {cards(collapsePast ? remainingItems : displayItems)}
    </div>
  );
}

export function DesktopDay({
  day,
  events,
  position,
  currentId,
  nextId,
  open,
  onToggle,
}: {
  day: ScheduleDay;
  events: readonly ScheduleEvent[];
  position: TallinnSchedulePosition | null;
  currentId?: string;
  nextId?: string;
  open: boolean;
  onToggle: () => void;
}) {
  const definition = SCHEDULE_DAYS.find((item) => item.value === day)!;
  const active = position?.day === day;
  const past = Boolean(position && day < position.day);
  const panelId = `desktop-week-day-${day}`;
  const prefix = active
    ? "Täna"
    : past
      ? "Möödunud"
      : day >= 6
        ? "Nädalavahetus"
        : "Päevaplaan";

  return (
    <section className={past ? "bg-[#edf0f2] dark:bg-[#0a151d]" : "bg-[#f8fafb] dark:bg-[#091925]"}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={`grid min-h-11 w-full grid-cols-[8rem_minmax(0,1fr)_auto] items-center gap-3 px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${
          active
            ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
            : past
              ? "text-[#7b858b] dark:text-[#748895]"
              : open
                ? "bg-[#e8eef2] text-[#172634] dark:bg-[#102538] dark:text-[#edf4f8]"
                : "text-[#526878] hover:bg-[#eef3f6] dark:text-[#a9b7c2] dark:hover:bg-[#0d2030]"
        }`}
      >
        <span className="text-[11px] font-black uppercase tracking-[0.06em]">{definition.label}</span>
        <span className={`truncate text-[10px] font-bold ${active ? "text-[#c7d5df] dark:text-[#173247]" : "text-[#617786] dark:text-[#8da1b0]"}`}>
          {prefix} · {displayEventSummary(events)}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </button>
      <div id={panelId} hidden={!open} className="border-t border-[#bdc9d1] dark:border-[#29485f]">
        <DayEvents
          events={events}
          position={position}
          currentId={currentId}
          nextId={nextId}
          collapsePast={active}
          desktopCompact
        />
      </div>
    </section>
  );
}
