"use client";

import { useRef, type KeyboardEvent } from "react";

import type { ScheduleData } from "@/lib/schedule-types";

import type { ScheduleEditorSection } from "./schedule-editor-helpers";

const SECTIONS: ReadonlyArray<{
  id: ScheduleEditorSection;
  label: string;
}> = [
  { id: "general", label: "Üldine" },
  { id: "events", label: "Nädal" },
  { id: "school", label: "Kool" },
  { id: "routines", label: "Rutiinid" },
  { id: "balance", label: "Tasakaal" },
];

function sectionCount(section: ScheduleEditorSection, data: ScheduleData): number | null {
  switch (section) {
    case "events": return data.events.length;
    case "school": return data.schoolPeriods.length;
    case "routines": return data.routines.length;
    case "balance": return data.studyPlans.length + data.metrics.length;
    default: return null;
  }
}

export function ScheduleEditorNavigation({
  activeSection,
  data,
  onChange,
}: {
  activeSection: ScheduleEditorSection;
  data: ScheduleData;
  onChange: (section: ScheduleEditorSection) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let targetIndex: number | null = null;
    if (event.key === "ArrowRight") targetIndex = (index + 1) % SECTIONS.length;
    if (event.key === "ArrowLeft") targetIndex = (index - 1 + SECTIONS.length) % SECTIONS.length;
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = SECTIONS.length - 1;
    if (targetIndex === null) return;

    event.preventDefault();
    onChange(SECTIONS[targetIndex].id);
    buttons.current[targetIndex]?.focus();
  }

  return (
    <nav className="no-scrollbar overflow-x-auto border-b border-[#aebcc6] bg-[#eef3f6] dark:border-[#29485f] dark:bg-[#102538]" aria-label="Ajakava redaktori osad">
      <div className="flex min-w-max" role="tablist" aria-label="Muudetav ajakava osa">
        {SECTIONS.map((section, index) => {
          const selected = section.id === activeSection;
          const count = sectionCount(section.id, data);
          return (
            <button
              key={section.id}
              ref={(element) => { buttons.current[index] = element; }}
              type="button"
              role="tab"
              id={`schedule-editor-tab-${section.id}`}
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-controls={selected ? "schedule-editor-panel" : undefined}
              onClick={() => onChange(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`min-h-12 border-r border-[#bdc9d1] px-4 text-[11px] font-black outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#29485f] sm:min-w-28 ${selected
                ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
                : "text-[#526878] hover:bg-white dark:text-[#9bb0bf] dark:hover:bg-[#0b1b29]"
              }`}
            >
              {section.label}
              {count !== null && <span className="ml-1.5 opacity-65 tabular-nums">{count}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
