"use client";

import { useRef, type KeyboardEvent } from "react";

import type { ScheduleEditorSection } from "./schedule-editor-helpers";

const SECTIONS: ReadonlyArray<{
  id: ScheduleEditorSection;
  label: string;
}> = [
  { id: "events", label: "Plaan" },
  { id: "routines", label: "Rutiinid" },
  { id: "balance", label: "Tasakaal" },
  { id: "general", label: "Seaded" },
];

export function ScheduleEditorNavigation({
  activeSection,
  onChange,
}: {
  activeSection: ScheduleEditorSection;
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
    <nav className="border-b border-[#aebcc6] bg-[#eef3f6] dark:border-[#29485f] dark:bg-[#102538]" aria-label="Ajakava redaktori osad">
      <div className="grid grid-cols-2 sm:grid-cols-4" role="tablist" aria-label="Muudetav ajakava osa">
        {SECTIONS.map((section, index) => {
          const selected = section.id === activeSection;
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
              className={`min-h-12 border-b border-r border-[#bdc9d1] px-3 text-[11px] font-black outline-none even:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#29485f] sm:border-b-0 sm:border-r sm:even:border-r sm:last:border-r-0 ${selected
                ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
                : "text-[#526878] hover:bg-white dark:text-[#9bb0bf] dark:hover:bg-[#0b1b29]"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
