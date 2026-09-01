"use client";

import type { ScheduleData } from "@/lib/schedule-types";

import { TextAreaField, TextField } from "./schedule-editor-fields";
import { EditorSectionHeader } from "./schedule-editor-section";

export function ScheduleGeneralEditor({
  data,
  onChange,
}: {
  data: ScheduleData;
  onChange: (data: ScheduleData) => void;
}) {
  const counts = [
    ["Nädala sündmused", data.events.length],
    ["Koolikirjed", data.schoolPeriods.length],
    ["Rutiinid", data.routines.length],
    ["Õppimiskirjed", data.studyPlans.length],
    ["Tasakaalu mõõdikud", data.metrics.length],
  ] as const;

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Põhiandmed"
        title="Ajakava nimi ja kirjeldus"
        description="Need tekstid kuvatakse sinu privaatse ajakava ülaosas. Tehniline versioon ja Eesti ajavöönd jäävad automaatselt paika."
      />
      <div className="grid gap-4 border border-[#aebcc6] bg-white p-4 shadow-[3px_3px_0_#d5dee4] dark:border-[#29485f] dark:bg-[#0b1b29] dark:shadow-[3px_3px_0_#102538] sm:p-5">
        <TextField label="Ajakava nimi" value={data.title} onChange={(title) => onChange({ ...data, title })} />
        <TextAreaField label="Alapealkiri" value={data.subtitle} maxLength={240} onChange={(subtitle) => onChange({ ...data, subtitle })} />
      </div>

      <div className="mt-5 border border-[#aebcc6] bg-[#eef3f6] dark:border-[#29485f] dark:bg-[#102538]">
        <header className="border-b border-[#bdc9d1] px-4 py-3 dark:border-[#29485f]">
          <h3 className="text-xs font-black text-[#172634] dark:text-[#edf4f8]">Sinu ajakava sisu</h3>
          <p className="mt-0.5 text-[10px] text-[#617786] dark:text-[#8da1b0]">Vali ülevalt sobiv osa, et selle kirjeid muuta.</p>
        </header>
        <dl className="grid gap-px bg-[#bdc9d1] dark:bg-[#29485f] sm:grid-cols-2 lg:grid-cols-3">
          {counts.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-[#0b1b29]">
              <dt className="text-[10px] font-black uppercase tracking-[0.06em] text-[#617786] dark:text-[#8da1b0]">{label}</dt>
              <dd className="text-lg font-black tabular-nums text-[#245fae] dark:text-signal">{count}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
