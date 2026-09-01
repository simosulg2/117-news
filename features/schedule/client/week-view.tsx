"use client";

import { useEffect, useRef, useState } from "react";

import {
  findCurrentAndNextScheduleEvent,
  getTallinnSchedulePosition,
  groupScheduleEventsByDay,
} from "@/features/schedule/model/schedule-events";
import { buildScheduleTimelineEvents } from "@/features/schedule/model/schedule-derived-events";
import type { ScheduleData, ScheduleDay, ScheduleEvent } from "@/lib/schedule-types";

import { SCHEDULE_DAYS } from "./schedule-formatters";
import {
  DayEvents,
  DesktopDay,
  displayEventSummary,
} from "./schedule-week-day";

type WeekViewProps = {
  data: ScheduleData;
  now: Date | null;
};

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
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f] md:flex md:items-end md:justify-between md:gap-4 md:pb-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal md:hidden">Nädal korraga</p>
          <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8] md:mt-0 md:text-lg">Nädalaplaan</h2>
        </div>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0] md:mt-0 md:text-[10px]">Kõik kellaajad on Tallinna ajas.</p>
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

      <div className="mt-3 hidden divide-y divide-[#bdc9d1] overflow-hidden border border-[#aebcc6] md:block dark:divide-[#29485f] dark:border-[#29485f]">
        {SCHEDULE_DAYS.map((day) => (
          <DesktopDay
            key={day.value}
            day={day.value}
            events={grouped[day.value]}
            position={position}
            currentId={focus.current?.event.day === day.value ? focus.current.event.id : undefined}
            nextId={focus.next?.event.day === day.value ? focus.next.event.id : undefined}
            open={openDay === day.value}
            onToggle={() => toggleDay(day.value)}
          />
        ))}
      </div>
    </div>
  );
}
