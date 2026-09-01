import {
  findCurrentAndNextScheduleEvent,
  getTallinnSchedulePosition,
  groupScheduleEventsByDay,
  isScheduleEventPast,
  type ScheduleOccurrence,
} from "@/features/schedule/model/schedule-events";
import { buildScheduleTimelineEvents } from "@/features/schedule/model/schedule-derived-events";
import type { ScheduleData, ScheduleEvent } from "@/lib/schedule-types";

import { ScheduleEventCard } from "./schedule-event-card";
import {
  formatOccurrence,
  formatScheduleDate,
  formatUntil,
} from "./schedule-formatters";

type TodayViewProps = {
  data: ScheduleData;
  now: Date | null;
};

function FocusCard({
  label,
  occurrence,
  nowTimestamp,
}: {
  label: "Praegu" | "Järgmine";
  occurrence: ScheduleOccurrence | null;
  nowTimestamp: number | null;
}) {
  const boundary = label === "Praegu" ? occurrence?.endTimestamp : occurrence?.startTimestamp;
  return (
    <article className="border border-[#aebcc6] bg-[#f8fafb] p-3 shadow-[3px_3px_0_#d4dfe5] dark:border-[#29485f] dark:bg-[#0d2030] dark:shadow-[3px_3px_0_#102538] sm:p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">
        {label}
      </p>
      {occurrence ? (
        <>
          <h2 className="mt-2 text-lg font-black leading-tight text-[#172634] dark:text-[#edf4f8]">
            {occurrence.event.title}
          </h2>
          <p className="mt-1 text-xs font-semibold text-[#526878] dark:text-[#9bb0bf]">
            {label === "Praegu" ? "Lõpeb" : "Algab"} {formatOccurrence(boundary!)}
            {nowTimestamp !== null && (
              <span className="text-[#245fae] dark:text-signal"> · {formatUntil(boundary!, nowTimestamp)}</span>
            )}
          </p>
          {occurrence.event.detail && (
            <p className="mt-2 text-xs leading-5 text-[#617786] dark:text-[#8da1b0]">
              {occurrence.event.detail}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm font-semibold text-[#617786] dark:text-[#9bb0bf]">
          {label === "Praegu" ? "Praegu pole ajastatud tegevust." : "Järgmist ajastatud tegevust pole."}
        </p>
      )}
    </article>
  );
}

function TodayEventCard({
  event,
  past,
  currentId,
  nextId,
}: {
  event: ScheduleEvent;
  past: boolean;
  currentId?: string;
  nextId?: string;
}) {
  return (
    <ScheduleEventCard
      event={event}
      past={past}
      state={event.id === currentId ? "current" : event.id === nextId ? "next" : undefined}
    />
  );
}

export function TodayView({ data, now }: TodayViewProps) {
  const timelineEvents = buildScheduleTimelineEvents(data);
  const nowTimestamp = now?.getTime() ?? null;
  const position = now ? getTallinnSchedulePosition(now) : null;
  const focus = now ? findCurrentAndNextScheduleEvent(timelineEvents, now) : { current: null, next: null };
  const grouped = groupScheduleEventsByDay(timelineEvents);
  const events = position ? grouped[position.day] : [];
  const nextIsToday = Boolean(
    position
      && focus.next
      && getTallinnSchedulePosition(focus.next.startTimestamp).localDate === position.localDate,
  );
  const pastEvents = position
    ? events.filter((event) => isScheduleEventPast(event, position.minuteOfDay))
    : [];
  const pastIds = new Set(pastEvents.map((event) => event.id));
  const remainingEvents = events.filter((event) => !pastIds.has(event.id));
  const currentId = focus.current?.event.id;
  const nextId = nextIsToday ? focus.next?.event.id : undefined;

  return (
    <div>
      <div className="flex flex-col gap-1 border-b border-[#aebcc6] pb-3 dark:border-[#29485f] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Tänane fookus</p>
          <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Täna</h2>
        </div>
        <p className="text-xs font-semibold capitalize text-[#617786] dark:text-[#8da1b0]">
          {now ? `${formatScheduleDate(now)} · Eesti aeg` : "Eesti aeg"}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FocusCard label="Praegu" occurrence={focus.current} nowTimestamp={nowTimestamp} />
        <FocusCard label="Järgmine" occurrence={focus.next} nowTimestamp={nowTimestamp} />
      </div>

      <section aria-labelledby="today-timeline-heading" className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#617786] dark:text-[#7890a2]">Päeva joon</p>
            <h2 id="today-timeline-heading" className="mt-1 text-lg font-black text-[#172634] dark:text-[#edf4f8]">
              Kõik tänased tegevused
            </h2>
          </div>
          <span className="text-[11px] font-bold text-[#617786] dark:text-[#7890a2]">{events.length} kirjet</span>
        </div>

        {now === null ? (
          <p aria-live="polite" className="mt-3 border border-[#bdc9d1] bg-white p-4 text-sm text-[#617786] dark:border-[#29485f] dark:bg-[#0b1b29] dark:text-[#9bb0bf]">
            Tallinna aja määramine…
          </p>
        ) : events.length ? (
          <>
            <div className="mt-3 hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <TodayEventCard
                  key={event.id}
                  event={event}
                  past={pastIds.has(event.id)}
                  currentId={currentId}
                  nextId={nextId}
                />
              ))}
            </div>
            <div className="mt-3 grid gap-2 md:hidden">
              {pastEvents.length > 0 && (
                <details className="group border border-[#bdc9d1] bg-[#eef1f3] dark:border-[#29485f] dark:bg-[#0a151d]">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-black text-[#65737c] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#82939e]">
                    <span>Möödunud · {pastEvents.length}</span>
                    <span aria-hidden="true" className="text-lg transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="grid gap-2 border-t border-[#c8d0d5] p-2 dark:border-[#263946]">
                    {pastEvents.map((event) => (
                      <TodayEventCard
                        key={event.id}
                        event={event}
                        past
                        currentId={currentId}
                        nextId={nextId}
                      />
                    ))}
                  </div>
                </details>
              )}
              {remainingEvents.map((event) => (
                <TodayEventCard
                  key={event.id}
                  event={event}
                  past={false}
                  currentId={currentId}
                  nextId={nextId}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 border border-dashed border-[#9fb2c0] p-5 text-sm text-[#617786] dark:border-[#35536a] dark:text-[#9bb0bf]">
            Tänaseks pole ajastatud tegevusi.
          </p>
        )}
      </section>
    </div>
  );
}
