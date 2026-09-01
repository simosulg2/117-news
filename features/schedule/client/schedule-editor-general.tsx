"use client";

import type { ScheduleData } from "@/lib/schedule-types";
import { formatScheduleWindow } from "@/features/schedule/model/schedule-events";

import { TextAreaField, TextField } from "./schedule-editor-fields";
import { EditorSectionHeader } from "./schedule-editor-section";
import { SCHEDULE_DAYS } from "./schedule-formatters";

export function ScheduleGeneralEditor({
  data,
  onChange,
}: {
  data: ScheduleData;
  onChange: (data: ScheduleData) => void;
}) {
  const hiddenIds = new Set(data.hiddenEventIds ?? []);
  const hiddenEvents = data.events.filter((event) => hiddenIds.has(event.id));

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Põhiandmed"
        title="Nimi ja lühikirjeldus"
        description="Need kaks teksti kuvatakse ajakava ülaosas. Kõik tehniline jääb automaatselt paika."
      />
      <div className="grid gap-4 border border-[#aebcc6] bg-white p-4 shadow-[3px_3px_0_#d5dee4] dark:border-[#29485f] dark:bg-[#0b1b29] dark:shadow-[3px_3px_0_#102538] sm:p-5">
        <TextField label="Ajakava nimi" value={data.title} onChange={(title) => onChange({ ...data, title })} />
        <TextAreaField label="Alapealkiri" value={data.subtitle} maxLength={240} onChange={(subtitle) => onChange({ ...data, subtitle })} />
      </div>

      <p className="mt-4 border-l-4 border-[#245fae] bg-[#eaf2fa] px-3 py-2 text-xs leading-5 text-[#34546d] dark:bg-[#102538] dark:text-[#b8c9d4]">
        Igapäevased muudatused tee osas <strong>Plaan</strong>. Seal on tunniplaan ja muud tegevused ühe päeva kaupa koos.
      </p>

      {hiddenEvents.length > 0 && (
        <details className="group mt-4 border border-[#aebcc6] bg-white dark:border-[#29485f] dark:bg-[#0b1b29]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-xs font-black text-[#526878] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#b8c9d4]">
            <span>Vanad peidetud duplikaadid ({hiddenEvents.length})</span>
            <span aria-hidden="true" className="text-lg group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-2 border-t border-[#d5dee4] bg-[#f8fafb] p-3 dark:border-[#263d50] dark:bg-[#091925]">
            <p className="text-[11px] leading-5 text-[#617786] dark:text-[#9bb0bf]">
              Need on vanast mallist peidetud read. Kui mõni neist oli päriselt sinu enda tegevus, taasta see ühe vajutusega ja muuda edasi osas Plaan.
            </p>
            {hiddenEvents.map((event) => (
              <div key={event.id} className="flex flex-col gap-2 border border-[#bdc9d1] bg-white p-3 dark:border-[#29485f] dark:bg-[#0b1b29] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-xs font-black text-[#172634] dark:text-[#edf4f8]">{event.title}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-[#617786] dark:text-[#9bb0bf]">
                    {SCHEDULE_DAYS.find((day) => day.value === event.day)?.label} · {formatScheduleWindow(event)}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-10 shrink-0 border border-[#245fae] px-3 text-[10px] font-black text-[#245fae] outline-none hover:bg-[#eaf2fa] focus-visible:ring-2 focus-visible:ring-signal dark:border-signal dark:text-signal dark:hover:bg-[#102538]"
                  onClick={() => onChange({
                    ...data,
                    hiddenEventIds: (data.hiddenEventIds ?? []).filter((id) => id !== event.id),
                  })}
                >
                  Taasta tegevus
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
