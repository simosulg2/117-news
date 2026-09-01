"use client";

import { useEffect, useRef, useState } from "react";

import {
  findCurrentAndNextScheduleEvent,
  getTallinnSchedulePosition,
  groupScheduleEventsByDay,
  sortScheduleEvents,
} from "@/features/schedule/model/schedule-events";
import type { ScheduleData, ScheduleDay, ScheduleEvent } from "@/lib/schedule-types";

import { ScheduleEventCard } from "./schedule-event-card";
import { SCHEDULE_DAYS } from "./schedule-formatters";

type WeekViewProps = {
  data: ScheduleData;
  now: Date | null;
};

function DayHeading({ day, active }: { day: ScheduleDay; active: boolean }) {
  const definition = SCHEDULE_DAYS.find((item) => item.value === day)!;
  return (
    <div className={`flex min-h-11 items-center justify-between gap-2 border-b px-3 ${
      active
        ? "border-[#245fae] bg-[#102538] text-white dark:border-signal dark:bg-signal dark:text-[#07131f]"
        : "border-[#bdc9d1] bg-[#dfe8ee] text-[#526878] dark:border-[#29485f] dark:bg-[#102538] dark:text-[#a9b7c2]"
    }`}>
      <h3 className="text-xs font-black uppercase tracking-[0.06em]">{definition.label}</h3>
      <span className="text-[10px] font-black">{definition.shortLabel}</span>
    </div>
  );
}

function displayEventSummary(events: readonly ScheduleEvent[]): string {
  const hasSchool = events.some((event) => event.id.startsWith("school-"));
  if (hasSchool) return "Koolipäev";
  const count = events.length;
  return count ? `${count} ${count === 1 ? "plokk" : "plokki"}` : "Vaba päev";
}

function MobileDayHeading({
  day,
  active,
  open,
  events,
  controls,
  onToggle,
}: {
  day: ScheduleDay;
  active: boolean;
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
          : open
            ? "bg-[#d9edf1] text-[#172634] dark:bg-[#102538] dark:text-[#edf4f8]"
            : "bg-[#eef3f6] text-[#526878] hover:bg-[#dfe8ee] dark:bg-[#0d2030] dark:text-[#a9b7c2] dark:hover:bg-[#102538]"
      }`}
    >
      <span className={`flex size-8 shrink-0 items-center justify-center border text-sm font-black ${
        active
          ? "border-white/45 dark:border-[#07131f]/40"
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
  currentId,
  nextId,
}: {
  events: readonly ScheduleEvent[];
  currentId?: string;
  nextId?: string;
}) {
  if (!events.length) {
    return <p className="p-3 text-[11px] text-[#526878] dark:text-[#7890a2]">Vaba päev</p>;
  }

  const schoolEvents = events.filter((event) => event.id.startsWith("school-"));
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
  const displayEvents = sortScheduleEvents([
    ...events.filter((event) => !event.id.startsWith("school-")),
    ...(schoolSummary ? [schoolSummary] : []),
  ]);
  const schoolIds = new Set(schoolEvents.map((event) => event.id));

  return (
    <div className="grid gap-2 p-2">
      {displayEvents.map((event) => {
        const summarizedSchool = event.id.startsWith("school-summary-");
        const isCurrent = summarizedSchool ? schoolIds.has(currentId ?? "") : event.id === currentId;
        const isNext = summarizedSchool ? schoolIds.has(nextId ?? "") : event.id === nextId;
        return (
          <ScheduleEventCard
            key={event.id}
            event={event}
            compact
            state={isCurrent ? "current" : isNext ? "next" : undefined}
          />
        );
      })}
    </div>
  );
}

export function WeekView({ data, now }: WeekViewProps) {
  const grouped = groupScheduleEventsByDay(data.events);
  const position = now ? getTallinnSchedulePosition(now) : null;
  const focus = now ? findCurrentAndNextScheduleEvent(data.events, now) : { current: null, next: null };
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
          return (
          <section key={day.value} className="border border-[#aebcc6] bg-[#f8fafb] dark:border-[#29485f] dark:bg-[#091925]">
            <MobileDayHeading
              day={day.value}
              active={position?.day === day.value}
              open={open}
              events={grouped[day.value]}
              controls={panelId}
              onToggle={() => toggleDay(day.value)}
            />
            <div id={panelId} hidden={!open} className="border-t border-[#aebcc6] dark:border-[#29485f]">
              <DayEvents
                events={grouped[day.value]}
                currentId={focus.current?.event.day === day.value ? focus.current.event.id : undefined}
                nextId={focus.next?.event.day === day.value ? focus.next.event.id : undefined}
              />
            </div>
          </section>
          );
        })}
      </div>

      <div className="mt-4 hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:hidden">
        {SCHEDULE_DAYS.map((day) => (
          <section key={day.value} className="border border-[#aebcc6] bg-[#f8fafb] dark:border-[#29485f] dark:bg-[#091925]">
            <DayHeading day={day.value} active={position?.day === day.value} />
            <DayEvents
              events={grouped[day.value]}
              currentId={focus.current?.event.day === day.value ? focus.current.event.id : undefined}
              nextId={focus.next?.event.day === day.value ? focus.next.event.id : undefined}
            />
          </section>
        ))}
      </div>

      <div className="mt-4 hidden grid-cols-7 border border-[#aebcc6] bg-[#bdc9d1] xl:grid dark:border-[#29485f] dark:bg-[#29485f]">
        {SCHEDULE_DAYS.map((day) => (
          <section key={day.value} className="min-w-0 bg-[#f8fafb] dark:bg-[#091925] [&:not(:last-child)]:border-r [&:not(:last-child)]:border-[#bdc9d1] dark:[&:not(:last-child)]:border-[#29485f]">
            <DayHeading day={day.value} active={position?.day === day.value} />
            <DayEvents
              events={grouped[day.value]}
              currentId={focus.current?.event.day === day.value ? focus.current.event.id : undefined}
              nextId={focus.next?.event.day === day.value ? focus.next.event.id : undefined}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
