"use client";

import { useState } from "react";

import type { ScheduleDay, SchoolPeriod } from "@/lib/schedule-types";

import { DaySelect, EditorEmpty, TextAreaField, TextField } from "./schedule-editor-fields";
import { newSchoolPeriod, removeItem, replaceItem } from "./schedule-editor-helpers";
import { EditorItem, EditorSectionHeader } from "./schedule-editor-section";
import { SCHEDULE_DAYS } from "./schedule-formatters";

export function ScheduleSchoolEditor({
  periods,
  onChange,
}: {
  periods: SchoolPeriod[];
  onChange: (periods: SchoolPeriod[]) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(1);
  const visible = periods
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => period.day === selectedDay);
  const selectedDefinition = SCHEDULE_DAYS.find((day) => day.value === selectedDay)!;

  const update = (index: number, next: SchoolPeriod) => onChange(replaceItem(periods, index, next));

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Tunniplaan"
        title="Koolitunnid"
        description="Muuda Kool vaate tunniplaani ruute ühe päeva kaupa. Need kirjed ei muuda Täna ega Nädal vaate sündmusi automaatselt."
        count={periods.length}
        addLabel={`Lisa ${selectedDefinition.label.toLocaleLowerCase("et")} kirje`}
        onAdd={() => onChange([...periods, newSchoolPeriod(periods, selectedDay)])}
      />

      <div className="mb-4 grid grid-cols-5 border border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f]" role="group" aria-label="Vali muudetav koolipäev">
        {SCHEDULE_DAYS.slice(0, 5).map((day) => {
          const selected = selectedDay === day.value;
          const count = periods.filter((period) => period.day === day.value).length;
          return (
            <button
              key={day.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedDay(day.value)}
              className={`min-h-14 border-r border-[#aebcc6] px-1 text-xs font-black outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#29485f] ${selected
                ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
                : "bg-white text-[#526878] hover:bg-[#edf3f7] dark:bg-[#0b1b29] dark:text-[#9bb0bf] dark:hover:bg-[#102538]"
              }`}
            >
              <span className="block sm:hidden">{day.shortLabel}</span>
              <span className="hidden sm:block">{day.label}</span>
              <span className={`mt-0.5 block text-[9px] ${selected ? "opacity-80" : "text-[#7890a2]"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <div className="grid gap-4">
          {visible.map(({ period, index }, visibleIndex) => (
            <EditorItem
              key={period.id}
              number={visibleIndex + 1}
              title={`${period.period}: ${period.subjectEt}`}
              onDelete={() => onChange(removeItem(periods, index))}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DaySelect value={period.day} onChange={(day) => update(index, { ...period, day })} />
                <TextField label="Tunni number" value={period.period} placeholder="nt 1. tund või Lõunapaus" maxLength={32} onChange={(value) => update(index, { ...period, period: value })} />
                <TextField label="Kellaaeg" value={period.timeWindow} placeholder="nt 08:30–09:45" onChange={(timeWindow) => update(index, { ...period, timeWindow })} />
                <TextField label="Aine" value={period.subjectEt} onChange={(subjectEt) => update(index, { ...period, subjectEt })} />
              </div>
              <TextAreaField label="Märkus" value={period.note} placeholder="Valikuline ruum, õpetaja või meeldetuletus" onChange={(note) => update(index, { ...period, note })} />
            </EditorItem>
          ))}
        </div>
      ) : <EditorEmpty>{`${selectedDefinition.label} pole veel ühtegi koolikirjet.`}</EditorEmpty>}
    </section>
  );
}
