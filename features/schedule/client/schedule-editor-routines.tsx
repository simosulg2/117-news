"use client";

import { useEffect, useState } from "react";

import { parseRoutineTimeWindow } from "@/features/schedule/model/schedule-derived-events";
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
  minutesToTimeInput,
  newRoutine,
  removeItem,
  replaceItem,
  timeInputToMinutes,
} from "./schedule-editor-helpers";
import { CompactEditorItem, EditorSectionHeader } from "./schedule-editor-section";

const SECTIONS: ReadonlyArray<{ value: RoutineItem["section"]; label: string; description: string }> = [
  { value: "morning", label: "Hommik", description: "Päeva algus" },
  { value: "evening", label: "Õhtu", description: "Päeva lõpp" },
  { value: "fitness", label: "Liikumine", description: "Trennid" },
];

const TIME_CLASS = "mt-1.5 min-h-11 w-full border border-[#9fb2c0] bg-white px-3 py-2 text-sm font-bold tabular-nums text-[#172634] outline-none focus:border-[#245fae] focus:ring-2 focus:ring-[#245fae]/20 dark:border-[#35536a] dark:bg-[#091925] dark:text-[#edf4f8] dark:focus:border-signal dark:focus:ring-signal/20";

function RoutineTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const parsedWindow = parseRoutineTimeWindow(value);
  const [timeMode, setTimeMode] = useState<"clock" | "text">(() => parsedWindow ? "clock" : "text");

  useEffect(() => {
    if (timeMode === "clock" && !parsedWindow) setTimeMode("text");
  }, [parsedWindow, timeMode]);

  if (timeMode === "text") {
    return (
      <div className="grid gap-2">
        <TextField
          label="Kellaaeg või märge"
          value={value}
          placeholder="nt Paindlik"
          onChange={onChange}
        />
        <button
          type="button"
          className="min-h-9 justify-self-start text-[10px] font-black text-[#245fae] underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-signal"
          onClick={() => {
            setTimeMode("clock");
            if (!parsedWindow) onChange("07:00–07:15");
          }}
        >
          Kasuta algus- ja lõpuaega
        </button>
      </div>
    );
  }
  const window = parsedWindow ?? { startMinute: 420, endMinute: 435 };
  const update = (startMinute: number, endMinute: number) => {
    onChange(`${minutesToTimeInput(startMinute)}–${minutesToTimeInput(endMinute)}`);
  };
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] dark:text-[#9bb0bf]">
          Algus
          <input
            type="time"
            className={TIME_CLASS}
            value={minutesToTimeInput(window.startMinute)}
            onChange={(event) => {
              const minute = timeInputToMinutes(event.target.value);
              if (minute !== null) update(minute, window.endMinute);
            }}
          />
        </label>
        <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] dark:text-[#9bb0bf]">
          Lõpp
          <input
            type="time"
            className={TIME_CLASS}
            value={minutesToTimeInput(window.endMinute)}
            onChange={(event) => {
              const minute = timeInputToMinutes(event.target.value);
              if (minute !== null) update(window.startMinute, minute);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        className="min-h-9 justify-self-start text-[10px] font-black text-[#245fae] underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-signal"
        onClick={() => {
          setTimeMode("text");
          onChange("Paindlik");
        }}
      >
        Kellaaeg pole oluline
      </button>
    </div>
  );
}

export function ScheduleRoutinesEditor({
  routines,
  validationPath,
  onChange,
}: {
  routines: RoutineItem[];
  validationPath?: string | null;
  onChange: (routines: RoutineItem[]) => void;
}) {
  const [selectedSection, setSelectedSection] = useState<RoutineItem["section"]>("morning");
  const invalidIndex = Number(/^\$\.routines\[(\d+)\]/u.exec(validationPath ?? "")?.[1]);
  const highlightedId = Number.isInteger(invalidIndex) ? routines[invalidIndex]?.id : undefined;
  const visible = routines
    .map((routine, index) => ({ routine, index }))
    .filter(({ routine }) => routine.section === selectedSection);
  const visibleIds = visible.map(({ routine }) => routine.id);
  const selectedDefinition = SECTIONS.find((section) => section.value === selectedSection)!;
  const update = (index: number, next: RoutineItem) => onChange(replaceItem(routines, index, next));

  useEffect(() => {
    const invalidSection = routines.find((routine) => routine.id === highlightedId)?.section;
    if (invalidSection) setSelectedSection(invalidSection);
  }, [highlightedId, routines]);

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Päeva rütm"
        title="Rutiinid"
        description="Vali osa ja muuda samme otse. Harvem kasutatavad valikud on peidetud „Rohkem valikuid” alla."
        addLabel={`Lisa: ${selectedDefinition.label}`}
        onAdd={() => onChange([newRoutine(routines, selectedSection), ...routines])}
      />

      <div className="mb-5 grid grid-cols-3 border border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f]" role="group" aria-label="Vali rutiini osa">
        {SECTIONS.map((section) => {
          const selected = section.value === selectedSection;
          return (
            <button
              key={section.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedSection(section.value)}
              className={`min-h-14 border-r border-[#aebcc6] px-2 py-2 text-left outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#29485f] ${selected
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
        <div className="grid gap-3">
          {visible.map(({ routine, index }, visibleIndex) => (
            <CompactEditorItem
              key={routine.id}
              number={visibleIndex + 1}
              title={routine.title}
              summary={routine.timeWindow}
              forceExpanded={routine.id === highlightedId}
              onMoveUp={visibleIndex > 0 ? () => onChange(moveItemAmongIds(routines, routine.id, visibleIds, -1)) : undefined}
              onMoveDown={visibleIndex < visible.length - 1 ? () => onChange(moveItemAmongIds(routines, routine.id, visibleIds, 1)) : undefined}
              onDelete={() => onChange(removeItem(routines, index))}
              more={(
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <RoutineSectionSelect value={routine.section} onChange={(section) => {
                      const oldDefault = routine.section === "fitness" ? "exercise" : "routine";
                      const next: RoutineItem = {
                        ...routine,
                        section,
                        category: routine.category === oldDefault
                          ? (section === "fitness" ? "exercise" : "routine")
                          : routine.category,
                      };
                      if (section === "fitness") next.day = routine.day ?? 1;
                      else delete next.day;
                      update(index, next);
                      setSelectedSection(section);
                    }} />
                    <CategorySelect value={routine.category} onChange={(category) => update(index, { ...routine, category })} />
                  </div>
                  <TextAreaField label="Selgitus" value={routine.details} placeholder="Valikuline lühike juhis" onChange={(details) => update(index, { ...routine, details })} />
                </>
              )}
            >
              <div className={`grid gap-3 ${routine.section === "fitness" ? "sm:grid-cols-[9rem_minmax(14rem,1fr)_minmax(0,1.5fr)]" : "sm:grid-cols-[minmax(14rem,1fr)_minmax(0,1.5fr)]"}`}>
                {routine.section === "fitness" && (
                  <OptionalDaySelect
                    value={routine.day}
                    emptyLabel="Päev määramata (ei ilmu ajajoonele)"
                    onChange={(day) => {
                      const next: RoutineItem = { ...routine };
                      if (day === undefined) delete next.day;
                      else next.day = day;
                      update(index, next);
                    }}
                  />
                )}
                <RoutineTimeField value={routine.timeWindow} onChange={(timeWindow) => update(index, { ...routine, timeWindow })} />
                <TextField label="Samm" value={routine.title} onChange={(title) => update(index, { ...routine, title })} />
              </div>
            </CompactEditorItem>
          ))}
        </div>
      ) : <EditorEmpty>Selles osas pole veel samme. Lisa ainult see, mida päriselt tahad jälgida.</EditorEmpty>}
    </section>
  );
}
