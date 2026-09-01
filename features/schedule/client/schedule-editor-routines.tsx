"use client";

import { useState } from "react";

import type { RoutineItem } from "@/lib/schedule-types";

import {
  CategorySelect,
  EditorEmpty,
  OptionalDaySelect,
  RoutineSectionSelect,
  TextAreaField,
  TextField,
} from "./schedule-editor-fields";
import {
  moveItemAmongIds,
  newRoutine,
  removeItem,
  replaceItem,
} from "./schedule-editor-helpers";
import { EditorItem, EditorSectionHeader } from "./schedule-editor-section";

const SECTIONS: ReadonlyArray<{ value: RoutineItem["section"]; label: string; description: string }> = [
  { value: "morning", label: "Hommik", description: "Tööpäeva algus" },
  { value: "evening", label: "Õhtu", description: "Tööpäeva lõpp" },
  { value: "fitness", label: "Liikumine", description: "Trennid päevade kaupa" },
];

export function ScheduleRoutinesEditor({
  routines,
  onChange,
}: {
  routines: RoutineItem[];
  onChange: (routines: RoutineItem[]) => void;
}) {
  const [selectedSection, setSelectedSection] = useState<RoutineItem["section"]>("morning");
  const visible = routines
    .map((routine, index) => ({ routine, index }))
    .filter(({ routine }) => routine.section === selectedSection);
  const visibleIds = visible.map(({ routine }) => routine.id);
  const selectedDefinition = SECTIONS.find((section) => section.value === selectedSection)!;

  const update = (index: number, next: RoutineItem) => onChange(replaceItem(routines, index, next));

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Päeva järjekord"
        title="Rutiinid"
        description="Hommik, õhtu ja liikumine on eraldi. Nooltega saad sammude kuvamisjärjekorda muuta."
        count={routines.length}
        addLabel={`Lisa: ${selectedDefinition.label}`}
        onAdd={() => onChange([...routines, newRoutine(routines, selectedSection)])}
      />

      <div className="mb-4 grid border border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f] sm:grid-cols-3" role="group" aria-label="Vali rutiini osa">
        {SECTIONS.map((section) => {
          const selected = section.value === selectedSection;
          return (
            <button
              key={section.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedSection(section.value)}
              className={`min-h-14 border-b border-[#aebcc6] px-3 py-2 text-left outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#29485f] sm:border-b-0 sm:border-r sm:last:border-r-0 ${selected
                ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
                : "bg-white text-[#526878] hover:bg-[#edf3f7] dark:bg-[#0b1b29] dark:text-[#9bb0bf] dark:hover:bg-[#102538]"
              }`}
            >
              <span className="block text-xs font-black">{section.label}</span>
              <span className="mt-0.5 block text-[9px] font-bold opacity-75">{section.description} · {routines.filter((item) => item.section === section.value).length}</span>
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <div className="grid gap-4">
          {visible.map(({ routine, index }, visibleIndex) => (
            <EditorItem
              key={routine.id}
              number={visibleIndex + 1}
              title={routine.title}
              onMoveUp={visibleIndex > 0 ? () => onChange(moveItemAmongIds(routines, routine.id, visibleIds, -1)) : undefined}
              onMoveDown={visibleIndex < visible.length - 1 ? () => onChange(moveItemAmongIds(routines, routine.id, visibleIds, 1)) : undefined}
              onDelete={() => onChange(removeItem(routines, index))}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <RoutineSectionSelect value={routine.section} onChange={(section) => {
                  const next: RoutineItem = { ...routine, section };
                  if (section === "fitness" && next.day === undefined) next.day = 1;
                  if (section !== "fitness") delete next.day;
                  update(index, next);
                }} />
                {routine.section === "fitness" ? (
                  <OptionalDaySelect value={routine.day} onChange={(day) => {
                    const next: RoutineItem = { ...routine, day };
                    if (day === undefined) delete next.day;
                    update(index, next);
                  }} />
                ) : (
                  <div className="border border-[#bdc9d1] bg-[#f8fafb] px-3 py-2.5 dark:border-[#29485f] dark:bg-[#091925]">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] dark:text-[#9bb0bf]">Päevad</p>
                    <p className="mt-1 text-sm font-bold text-[#172634] dark:text-[#edf4f8]">Tööpäeviti</p>
                  </div>
                )}
                <TextField label="Kellaaeg" value={routine.timeWindow} placeholder="nt 07:00–07:15" onChange={(timeWindow) => update(index, { ...routine, timeWindow })} />
                <CategorySelect value={routine.category} onChange={(category) => update(index, { ...routine, category })} />
              </div>
              <TextField label="Sammu nimi" value={routine.title} onChange={(title) => update(index, { ...routine, title })} />
              <TextAreaField label="Selgitus" value={routine.details} placeholder="Valikuline lühike juhis" onChange={(details) => update(index, { ...routine, details })} />
            </EditorItem>
          ))}
        </div>
      ) : <EditorEmpty>Selles rutiini osas pole veel samme.</EditorEmpty>}
    </section>
  );
}
