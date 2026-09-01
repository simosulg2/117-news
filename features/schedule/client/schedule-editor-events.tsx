"use client";

import { useEffect, useState } from "react";

import {
  mergePersonalScheduleEvents,
  personalScheduleEvents,
} from "@/features/schedule/model/schedule-derived-events";
import type { ScheduleData, ScheduleDay, ScheduleEvent } from "@/lib/schedule-types";

import {
  CategorySelect,
  DaySelect,
  EditorEmpty,
  TextAreaField,
  TextField,
} from "./schedule-editor-fields";
import {
  minutesToTimeInput,
  newScheduleEvent,
  removeItem,
  replaceItem,
  timeInputToMinutes,
} from "./schedule-editor-helpers";
import { CompactEditorItem, EditorSectionHeader } from "./schedule-editor-section";
import { SCHEDULE_DAYS } from "./schedule-formatters";
import { ScheduleSchoolEditor } from "./schedule-editor-school";

const TIME_CLASS = "mt-1.5 min-h-11 w-full border border-[#9fb2c0] bg-white px-3 py-2 text-sm font-bold tabular-nums text-[#172634] outline-none focus:border-[#245fae] focus:ring-2 focus:ring-[#245fae]/20 dark:border-[#35536a] dark:bg-[#091925] dark:text-[#edf4f8] dark:focus:border-signal dark:focus:ring-signal/20";

function currentTallinnDay(): ScheduleDay {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Tallinn",
    weekday: "short",
  }).format(new Date());
  const days: Record<string, ScheduleDay> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return days[weekday] ?? 1;
}

function TimeField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] dark:text-[#9bb0bf]">
      {label}
      <input type="time" className={TIME_CLASS} value={minutesToTimeInput(value)} onChange={(event) => onChange(timeInputToMinutes(event.target.value))} />
    </label>
  );
}

function DayPicker({
  selectedDay,
  data,
  onChange,
}: {
  selectedDay: ScheduleDay;
  data: ScheduleData;
  onChange: (day: ScheduleDay) => void;
}) {
  return (
    <div className="mb-5">
      <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] dark:text-[#9bb0bf] sm:hidden">
        Muudetav päev
        <select
          className="mt-1.5 min-h-11 w-full border border-[#9fb2c0] bg-white px-3 text-sm font-black text-[#172634] outline-none focus:border-[#245fae] focus:ring-2 focus:ring-[#245fae]/20 dark:border-[#35536a] dark:bg-[#091925] dark:text-[#edf4f8]"
          value={selectedDay}
          onChange={(event) => onChange(Number(event.target.value) as ScheduleDay)}
        >
          {SCHEDULE_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
        </select>
      </label>
      <div className="hidden grid-cols-7 border border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f] sm:grid" role="group" aria-label="Vali muudetav päev">
        {SCHEDULE_DAYS.map((day) => {
          const selected = selectedDay === day.value;
          const schoolCount = data.schoolPeriods.filter((period) => period.day === day.value).length;
          const otherCount = personalScheduleEvents(data).filter((event) => event.day === day.value).length;
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(day.value)}
              className={`min-h-14 border-r border-[#aebcc6] px-1 text-xs font-black outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#29485f] ${selected
                ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
                : "bg-white text-[#526878] hover:bg-[#edf3f7] dark:bg-[#0b1b29] dark:text-[#9bb0bf] dark:hover:bg-[#102538]"
              }`}
            >
              <span className="block">{day.shortLabel}</span>
              <span className={`mt-0.5 block text-[9px] ${selected ? "opacity-75" : "text-[#7890a2]"}`}>{schoolCount + otherCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SchedulePersonalEventsEditor({
  events,
  selectedDay,
  highlightedId,
  onSelectedDayChange,
  onChange,
}: {
  events: ScheduleEvent[];
  selectedDay: ScheduleDay;
  highlightedId?: string;
  onSelectedDayChange: (day: ScheduleDay) => void;
  onChange: (events: ScheduleEvent[]) => void;
}) {
  const visible = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.day === selectedDay);
  const dayLabel = SCHEDULE_DAYS.find((day) => day.value === selectedDay)?.label ?? "Päev";
  const update = (index: number, next: ScheduleEvent) => onChange(replaceItem(events, index, next));

  return (
    <section className="mt-8 border-t border-[#aebcc6] pt-6 dark:border-[#29485f]">
      <EditorSectionHeader
        eyebrow="Muud tegevused"
        title={`${dayLabel}: muu plaan`}
        description="Lisa siia ainult see, mis pole koolitund: trenn, sõit, kohtumine või muu isiklik tegevus."
        count={visible.length}
        addLabel="Lisa tegevus"
        onAdd={() => onChange([newScheduleEvent(events, selectedDay), ...events])}
      />

      {visible.length ? (
        <div className="grid gap-3">
          {visible.map(({ event, index }, visibleIndex) => (
            <CompactEditorItem
              key={event.id}
              number={visibleIndex + 1}
              title={event.title}
              forceExpanded={event.id === highlightedId}
              summary={event.startMinute === null || event.endMinute === null
                ? "Paindlik aeg"
                : `${minutesToTimeInput(event.startMinute)}–${minutesToTimeInput(event.endMinute)}`}
              onDelete={() => onChange(removeItem(events, index))}
              more={(
                <>
                  <DaySelect label="Teisalda päevale" value={event.day} onChange={(day) => {
                    update(index, { ...event, day });
                    onSelectedDayChange(day);
                  }} />
                  <CategorySelect value={event.category} onChange={(category) => update(index, { ...event, category })} />
                  <TextAreaField label="Lisainfo" value={event.detail ?? ""} placeholder="Valikuline selgitus" onChange={(detail) => update(index, { ...event, detail })} />
                </>
              )}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <TextField label="Tegevus" value={event.title} onChange={(title) => update(index, { ...event, title })} />
                <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end border border-[#bdc9d1] bg-[#f8fafb] px-3 text-xs font-black text-[#526878] dark:border-[#29485f] dark:bg-[#091925] dark:text-[#b8c9d4]">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#245fae]"
                    checked={event.startMinute === null && event.endMinute === null}
                    onChange={(input) => update(index, input.target.checked
                      ? { ...event, startMinute: null, endMinute: null, flexible: true }
                      : { ...event, startMinute: 540, endMinute: 600, flexible: false })}
                  />
                  Kellaaeg pole oluline
                </label>
              </div>
              {(event.startMinute !== null || event.endMinute !== null) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TimeField label="Algus" value={event.startMinute} onChange={(startMinute) => update(index, { ...event, startMinute, flexible: false })} />
                  <TimeField label="Lõpp" value={event.endMinute} onChange={(endMinute) => update(index, { ...event, endMinute, flexible: false })} />
                </div>
              )}
            </CompactEditorItem>
          ))}
        </div>
      ) : <EditorEmpty>Sellel päeval pole muid tegevusi. Koolitunde pole vaja siia uuesti lisada.</EditorEmpty>}
    </section>
  );
}

export function SchedulePlanEditor({
  data,
  validationPath,
  onChange,
}: {
  data: ScheduleData;
  validationPath?: string | null;
  onChange: (data: ScheduleData) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(currentTallinnDay);
  const personalEvents = personalScheduleEvents(data);
  const schoolIndex = Number(/^\$\.schoolPeriods\[(\d+)\]/u.exec(validationPath ?? "")?.[1]);
  const eventIndex = Number(/^\$\.events\[(\d+)\]/u.exec(validationPath ?? "")?.[1]);
  const highlightedSchoolId = Number.isInteger(schoolIndex) ? data.schoolPeriods[schoolIndex]?.id : undefined;
  const highlightedEventId = Number.isInteger(eventIndex) ? data.events[eventIndex]?.id : undefined;
  const hasSelectedDaySchool = data.schoolPeriods.some((period) => period.day === selectedDay);

  useEffect(() => {
    const invalidDay = highlightedSchoolId
      ? data.schoolPeriods.find((period) => period.id === highlightedSchoolId)?.day
      : data.events.find((event) => event.id === highlightedEventId)?.day;
    if (invalidDay) setSelectedDay(invalidDay);
  }, [data.events, data.schoolPeriods, highlightedEventId, highlightedSchoolId]);

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Üks nädalaplaan"
        title="Kool ja muud tegevused"
        description="Vali päev ja muuda kõik selle päeva kirjed samas kohas. Koolitunnid ilmuvad Täna, Nädal ja Kool vaadetesse automaatselt."
      />
      <DayPicker selectedDay={selectedDay} data={data} onChange={setSelectedDay} />
      {(selectedDay <= 5 || hasSelectedDaySchool) && (
        <ScheduleSchoolEditor
          periods={data.schoolPeriods}
          selectedDay={selectedDay}
          highlightedId={highlightedSchoolId}
          onSelectedDayChange={setSelectedDay}
          allowAdd={selectedDay <= 5}
          onChange={(schoolPeriods) => onChange({ ...data, schoolPeriods })}
        />
      )}
      <SchedulePersonalEventsEditor
        events={personalEvents}
        selectedDay={selectedDay}
        highlightedId={highlightedEventId}
        onSelectedDayChange={setSelectedDay}
        onChange={(events) => onChange({
          ...data,
          events: mergePersonalScheduleEvents(data, events),
        })}
      />
    </section>
  );
}
