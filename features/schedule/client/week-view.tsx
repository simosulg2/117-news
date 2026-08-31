import {
  findCurrentAndNextScheduleEvent,
  getTallinnSchedulePosition,
  groupScheduleEventsByDay,
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
  return (
    <div className="grid gap-2 p-2">
      {events.map((event) => (
        <ScheduleEventCard
          key={event.id}
          event={event}
          compact
          state={event.id === currentId ? "current" : event.id === nextId ? "next" : undefined}
        />
      ))}
    </div>
  );
}

export function WeekView({ data, now }: WeekViewProps) {
  const grouped = groupScheduleEventsByDay(data.events);
  const position = now ? getTallinnSchedulePosition(now) : null;
  const focus = now ? findCurrentAndNextScheduleEvent(data.events, now) : { current: null, next: null };

  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Nädal korraga</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Nädalaplaan</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Ajad on Europe/Tallinn ajavööndis.</p>
      </div>

      <div className="mt-4 grid gap-3 xl:hidden">
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
