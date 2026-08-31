"use client";

import { useRef, type KeyboardEvent } from "react";

export type ScheduleTab = "today" | "week" | "school" | "routines" | "study" | "balance";

const TABS: ReadonlyArray<{ id: ScheduleTab; label: string }> = [
  { id: "today", label: "Täna" },
  { id: "week", label: "Nädal" },
  { id: "school", label: "Kool" },
  { id: "routines", label: "Rutiinid" },
  { id: "study", label: "Õppimine" },
  { id: "balance", label: "Tasakaal" },
];

type ScheduleTabsProps = {
  activeTab: ScheduleTab;
  onChange: (tab: ScheduleTab) => void;
};

export function ScheduleTabs({ activeTab, onChange }: ScheduleTabsProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let targetIndex: number | null = null;
    if (event.key === "ArrowRight") targetIndex = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") targetIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = TABS.length - 1;
    if (targetIndex === null) return;

    event.preventDefault();
    const tab = TABS[targetIndex];
    onChange(tab.id);
    buttons.current[targetIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Ajakava vaated"
      className="no-scrollbar flex overflow-x-auto border border-[#aebcc6] bg-[#dbe5eb] dark:border-[#29485f] dark:bg-[#102538]"
    >
      {TABS.map((tab, index) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            id={`schedule-tab-${tab.id}`}
            role="tab"
            type="button"
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            aria-controls={active ? `schedule-panel-${tab.id}` : undefined}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`min-h-11 shrink-0 border-r border-[#aebcc6] px-4 text-xs font-bold outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal sm:flex-1 dark:border-[#29485f] ${
              active
                ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
                : "bg-white text-[#526878] hover:bg-[#edf3f7] hover:text-[#174b8d] dark:bg-[#0b1b29] dark:text-[#9bb0bf] dark:hover:bg-[#102538] dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function ScheduleTabPanel({
  tab,
  children,
}: {
  tab: ScheduleTab;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`schedule-panel-${tab}`}
      role="tabpanel"
      tabIndex={0}
      aria-labelledby={`schedule-tab-${tab}`}
      className="mt-4 outline-none focus-visible:ring-2 focus-visible:ring-signal"
    >
      {children}
    </section>
  );
}
