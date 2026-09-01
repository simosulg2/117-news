"use client";

import type { ScheduleDay, SchoolPeriod } from "@/lib/schedule-types";

import { DaySelect, EditorEmpty, TextAreaField, TextField } from "./schedule-editor-fields";
import { newSchoolPeriod, removeItem, replaceItem } from "./schedule-editor-helpers";
import { CompactEditorItem, EditorSectionHeader } from "./schedule-editor-section";
import { SCHEDULE_DAYS } from "./schedule-formatters";

export function ScheduleSchoolEditor({
  periods,
  selectedDay,
  highlightedId,
  onSelectedDayChange,
  allowAdd = true,
  onChange,
}: {
  periods: SchoolPeriod[];
  selectedDay: ScheduleDay;
  highlightedId?: string;
  onSelectedDayChange: (day: ScheduleDay) => void;
  allowAdd?: boolean;
  onChange: (periods: SchoolPeriod[]) => void;
}) {
  const visible = periods
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => period.day === selectedDay);
  const selectedDefinition = SCHEDULE_DAYS.find((day) => day.value === selectedDay)!;
  const update = (index: number, next: SchoolPeriod) => onChange(replaceItem(periods, index, next));

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Tunniplaan"
        title={`${selectedDefinition.label}: tunnid`}
        description="Muuda ainet, tunni numbrit või kellaaega siin ühe korra — samad andmed jõuavad ka päeva- ja nädalavaatesse."
        count={visible.length}
        addLabel={allowAdd ? "Lisa tund" : undefined}
        onAdd={allowAdd ? () => onChange([newSchoolPeriod(periods, selectedDay), ...periods]) : undefined}
      />

      {visible.length ? (
        <div className="grid gap-3">
          {visible.map(({ period, index }, visibleIndex) => (
            <CompactEditorItem
              key={period.id}
              number={visibleIndex + 1}
              title={`${period.period}: ${period.subjectEt}`}
              summary={period.timeWindow}
              forceExpanded={period.id === highlightedId}
              forceMoreExpanded={period.id === highlightedId}
              onDelete={() => onChange(removeItem(periods, index))}
              more={(
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Tund" value={period.period} placeholder="nt 1. tund" maxLength={32} onChange={(value) => update(index, { ...period, period: value })} />
                    <TextField label="Kellaaeg" value={period.timeWindow} placeholder="nt 08:30–09:45" onChange={(timeWindow) => update(index, { ...period, timeWindow })} />
                  </div>
                  <DaySelect label="Teisalda päevale" value={period.day} onChange={(day) => {
                    update(index, { ...period, day });
                    onSelectedDayChange(day);
                  }} />
                  <TextAreaField label="Märkus" value={period.note} placeholder="Valikuline ruum, õpetaja või meeldetuletus" onChange={(note) => update(index, { ...period, note })} />
                </>
              )}
            >
              <TextField label="Aine" value={period.subjectEt} onChange={(subjectEt) => update(index, { ...period, subjectEt })} />
            </CompactEditorItem>
          ))}
        </div>
      ) : <EditorEmpty>{`${selectedDefinition.label} pole koolitunde. Vaba päeva ei pea eraldi täitma.`}</EditorEmpty>}
    </section>
  );
}
