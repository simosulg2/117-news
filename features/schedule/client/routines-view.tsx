import type { RoutineItem, ScheduleData } from "@/lib/schedule-types";

import {
  CATEGORY_ACCENTS,
  CATEGORY_LABELS,
  SCHEDULE_DAYS,
} from "./schedule-formatters";

const SECTIONS: ReadonlyArray<{
  id: RoutineItem["section"];
  label: string;
  description: string;
}> = [
  { id: "morning", label: "Hommik", description: "Päeva käivitavad tegevused" },
  { id: "evening", label: "Õhtu", description: "Päeva lõpetamine ja taastumine" },
  { id: "fitness", label: "Liikumine", description: "Jooks, trenn ja pesu" },
];

function routineDay(item: RoutineItem): string {
  if (!item.day) {
    return item.section === "fitness" ? "Paindlik" : "Tööpäeviti";
  }
  return SCHEDULE_DAYS.find((day) => day.value === item.day)?.label ?? "—";
}

export function RoutinesView({ data }: { data: ScheduleData }) {
  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Korduvad tegevused</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Rutiinid</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Hommik, õhtu ja liikumine kompaktses vaates.</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {SECTIONS.map((section) => {
          const items = data.routines.filter((item) => item.section === section.id);
          return (
            <section key={section.id} aria-labelledby={`routine-${section.id}`} className="border border-[#aebcc6] bg-[#f8fafb] dark:border-[#29485f] dark:bg-[#091925]">
              <header className="border-b border-[#bdc9d1] bg-[#dfe8ee] px-3 py-2.5 dark:border-[#29485f] dark:bg-[#102538]">
                <h3 id={`routine-${section.id}`} className="text-sm font-black text-[#172634] dark:text-[#edf4f8]">{section.label}</h3>
                <p className="mt-0.5 text-[10px] text-[#617786] dark:text-[#8da1b0]">{section.description}</p>
              </header>
              {items.length ? (
                <div className="grid gap-2 p-2">
                  {items.map((item) => (
                    <article key={item.id} className={`border border-l-4 border-[#bdc9d1] bg-white p-3 ${CATEGORY_ACCENTS[item.category]} dark:border-y-[#29485f] dark:border-r-[#29485f] dark:bg-[#0b1b29]`}>
                      <div className="flex items-start justify-between gap-2 text-[10px] font-black uppercase tracking-[0.06em]">
                        <span className="tabular-nums text-[#245fae] dark:text-signal">{item.timeWindow}</span>
                        <span className="text-[#526878] dark:text-[#7890a2]">{routineDay(item)}</span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-black text-[#172634] dark:text-[#edf4f8]">{item.title}</h4>
                      {item.details && <p className="mt-1 text-[11px] leading-4 text-[#617786] dark:text-[#8da1b0]">{item.details}</p>}
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#526878] dark:text-[#7890a2]">{CATEGORY_LABELS[item.category]}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-xs text-[#617786] dark:text-[#8da1b0]">Selles jaotises pole kirjeid.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
