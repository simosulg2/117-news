"use client";

import { useEffect, useRef, useState } from "react";

import {
  findCurrentAndNextScheduleEvent,
  getTallinnSchedulePosition,
  groupScheduleEventsByDay,
  isScheduleEventPast,
  sortScheduleEvents,
  type TallinnSchedulePosition,
} from "@/features/schedule/model/schedule-events";
import {
  buildScheduleTimelineEvents,
  isDerivedSchoolPeriodEvent,
} from "@/features/schedule/model/schedule-derived-events";
import type { ScheduleData, ScheduleDay, ScheduleEvent } from "@/lib/schedule-types";

import { ScheduleEventCard } from "./schedule-event-card";
import { SCHEDULE_DAYS } from "./schedule-formatters";

type WeekViewProps = {
  data: ScheduleData;
  now: Date | null;
};

function DayHeading({ day, active, past }: { day: ScheduleDay; active: boolean; past: boolean }) {
  const definition = SCHEDULE_DAYS.find((item) => item.value === day)!;
  return (
    <div className={`flex min-h-11 items-center justify-between gap-2 border-b px-3 ${
      active
        ? "border-[#245fae] bg-[#102538] text-white dark:border-signal dark:bg-signal dark:text-[#07131f]"
        : past
          ? "border-[#c3cbd1] bg-[#e3e6e8] text-[#7b858b] dark:border-[#263946] dark:bg-[#0a151d] dark:text-[#748895]"
        : "border-[#bdc9d1] bg-[#dfe8ee] text-[#526878] dark:border-[#29485f] dark:bg-[#102538] dark:text-[#a9b7c2]"
    }`}>
      <h3 className="text-xs font-black uppercase tracking-[0.06em]">{definition.label}</h3>
      <span className="text-[10px] font-black">{definition.shortLabel}</span>
    </div>
  );
}

function displayEventSummary(events: readonly ScheduleEvent[]): string {
  const hasSchool = events.some(isDerivedSchoolPeriodEvent);
  if (hasSchool) return "Koolipäev";
  const count = events.length;
  return count ? `${count} ${count === 1 ? "plokk" : "plokki"}` : "Vaba päev";
}

function MobileDayHeading({
  day,
  active,
  past,
  open,
  events,
  controls,
  onToggle,
}: {
  day: ScheduleDay;
  active: boolean;
  past: boolean;
  open: boolean;
  events: readonly ScheduleEvent[];
  controls: string;
  onToggle: () => void;
}) {
  const definition = SCHEDULE_DAYS.find((item) => item.value === day)!;
  const summary = displayEventSummary(events);
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={`flex min-h-14 w-full items-center gap-3 px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal ${
        active
          ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
          : past
            ? "bg-[#e3e6e8] text-[#7b858b] dark:bg-[#0a151d] dark:text-[#748895]"
          : open
            ? "bg-[#d9edf1] text-[#172634] dark:bg-[#102538] dark:text-[#edf4f8]"
            : "bg-[#eef3f6] text-[#526878] hover:bg-[#dfe8ee] dark:bg-[#0d2030] dark:text-[#a9b7c2] dark:hover:bg-[#102538]"
      }`}
    >
      <span className={`flex size-8 shrink-0 items-center justify-center border text-sm font-black ${
        active
          ? "border-white/45 dark:border-[#07131f]/40"
          : past
            ? "border-[#c3cbd1] bg-[#edf0f2] text-[#7b858b] dark:border-[#263946] dark:bg-[#0d1b24] dark:text-[#748895]"
          : "border-[#aebcc6] bg-white text-[#174b8d] dark:border-[#35536a] dark:bg-[#0b1b29] dark:text-signal"
      }`} aria-hidden="true">
        {definition.shortLabel}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{definition.label}</span>
        <span className={`mt-0.5 block text-[10px] font-bold ${active ? "text-[#c7d5df] dark:text-[#173247]" : "text-[#6f8493] dark:text-[#7890a2]"}`}>
          {summary}
        </span>
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </button>
  );
}

function DayEvents({
  events,
  position,
  currentId,
  nextId,
  collapsePast,
}: {
  events: readonly ScheduleEvent[];
  position: TallinnSchedulePosition | null;
  currentId?: string;
  nextId?: string;
  collapsePast?: boolean;
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

  const cards = (items: typeof displayItems) => items.map(({ event, current, next, past }) => (
    <ScheduleEventCard
      key={event.id}
      event={event}
      compact
      past={past}
      state={current ? "current" : next ? "next" : undefined}
    />
  ));

  return (
    <div className="grid gap-2 p-2">
      {collapsePast && pastItems.length > 0 && (
        <details className="group border border-[#c3cbd1] bg-[#e3e6e8] dark:border-[#263946] dark:bg-[#0a151d]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-2.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#65737c] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#82939e]">
            <span>Möödunud · {pastItems.length}</span>
            <span aria-hidden="true" className="text-base transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-2 border-t border-[#c3cbd1] p-2 dark:border-[#263946]">
            {cards(pastItems)}
          </div>
        </details>
      )}
      {cards(collapsePast ? remainingItems : displayItems)}
    </div>
  );
}

export function WeekView({ data, now }: WeekViewProps) {
  const timelineEvents = buildScheduleTimelineEvents(data);
  const grouped = groupScheduleEventsByDay(timelineEvents);
  const position = now ? getTallinnSchedulePosition(now) : null;
  const focus = now ? findCurrentAndNextScheduleEvent(timelineEvents, now) : { current: null, next: null };
  const [openDay, setOpenDay] = useState<ScheduleDay | null>(1);
  const userSelectedDay = useRef(false);

  useEffect(() => {
    if (!position || userSelectedDay.current) return;
    setOpenDay(position.day);
  }, [position?.day]);

  function toggleDay(day: ScheduleDay) {
    userSelectedDay.current = true;
    setOpenDay((current) => current === day ? null : day);
  }

  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Nädal korraga</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Nädalaplaan</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Kõik kellaajad on Tallinna ajas.</p>
      </div>

      <div className="mt-4 grid gap-2 md:hidden">
        {SCHEDULE_DAYS.map((day) => {
          const panelId = `mobile-week-day-${day.value}`;
          const open = openDay === day.value;
          const pastDay = Boolean(position && day.value < position.day);
          return (
          <section key={day.value} className="border border-[#aebcc6] bg-[#f8fafb] dark:border-[#29485f] dark:bg-[#091925]">
            <MobileDayHeading
              day={day.value}
              active={position?.day === day.value}
              past={pastDay}
              open={open}
              events={grouped[day.value]}
              controls={panelId}
              onToggle={() => toggleDay(day.value)}
            />
            <div id={panelId} hidden={!open} className="border-t border-[#aebcc6] dark:border-[#29485f]">
              <DayEvents
                events={grouped[day.value]}
                position={position}
                currentId={focus.current?.event.day === day.value ? focus.current.event.id : undefined}
                nextId={focus.next?.event.day === day.value ? focus.next.event.id : undefined}
                collapsePast={position?.day === day.value}
              />
            </div>
          </section>
          );
        })}
      </div>

      <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:hidden">
        {SCHEDULE_DAYS.map((day) => (
          <section key={day.value} className="border border-[#aebcc6] bg-[#f8fafb] dark:border-[#29485f] dark:bg-[#091925]">
            <DayHeading day={day.value} active={position?.day === day.value} past={Boolean(position && day.value < position.day)} />
            <DayEvents
              events={grouped[day.value]}
              position={position}
              currentId={focus.current?.event.day === day.value ? focus.current.event.id : undefined}
              nextId={focus.next?.event.day === day.value ? focus.next.event.id : undefined}
            />
          </section>
        ))}
      </div>

      <div className="mt-4 hidden grid-cols-7 border border-[#aebcc6] bg-[#bdc9d1] xl:grid dark:border-[#29485f] dark:bg-[#29485f]">
        {SCHEDULE_DAYS.map((day) => (
          <section key={day.value} className="min-w-0 bg-[#f8fafb] dark:bg-[#091925] [&:not(:last-child)]:border-r [&:not(:last-child)]:border-[#bdc9d1] dark:[&:not(:last-child)]:border-[#29485f]">
            <DayHeading day={day.value} active={position?.day === day.value} past={Boolean(position && day.value < position.day)} />
            <DayEvents
              events={grouped[day.value]}
              position={position}
              currentId={focus.current?.event.day === day.value ? focus.current.event.id : undefined}
              nextId={focus.next?.event.day === day.value ? focus.next.event.id : undefined}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
