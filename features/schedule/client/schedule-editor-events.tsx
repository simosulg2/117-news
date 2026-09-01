"use client";

import type { ScheduleEvent } from "@/lib/schedule-types";

import {
  CategorySelect,
  DaySelect,
  EditorEmpty,
  TextAreaField,
  TextField,
} from "./schedule-editor-fields";
import {
  minutesToTimeInput,
  moveItem,
  newScheduleEvent,
  removeItem,
  replaceItem,
  timeInputToMinutes,
} from "./schedule-editor-helpers";
import { EditorItem, EditorSectionHeader } from "./schedule-editor-section";

const TIME_CLASS = "mt-1.5 min-h-11 w-full border border-[#9fb2c0] bg-white px-3 py-2 text-sm font-bold tabular-nums text-[#172634] outline-none focus:border-[#245fae] focus:ring-2 focus:ring-[#245fae]/20 dark:border-[#35536a] dark:bg-[#091925] dark:text-[#edf4f8] dark:focus:border-signal dark:focus:ring-signal/20";

function TimeField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] dark:text-[#9bb0bf]">
      {label}
      <input type="time" className={TIME_CLASS} value={minutesToTimeInput(value)} onChange={(event) => onChange(timeInputToMinutes(event.target.value))} />
    </label>
  );
}

export function ScheduleEventsEditor({
  events,
  onChange,
}: {
  events: ScheduleEvent[];
  onChange: (events: ScheduleEvent[]) => void;
}) {
  const update = (index: number, next: ScheduleEvent) => onChange(replaceItem(events, index, next));

  return (
    <section>
      <EditorSectionHeader
        eyebrow="Nädalavaade"
        title="Nädala sündmused"
        description="Siia kuuluvad Täna ja Nädal vaadetes kuvatavad tegevused. Koolitundide muutmine ei uuenda neid sündmusi automaatselt."
        count={events.length}
        addLabel="Lisa sündmus"
        onAdd={() => onChange([...events, newScheduleEvent(events)])}
      />

      <p className="mb-4 border-l-4 border-[#b36b24] bg-[#f7ead2] px-3 py-2 text-[11px] leading-5 text-[#67460f] dark:bg-[#2b2417] dark:text-[#efc983]">
        Tunniplaani ruudud ja nädala sündmused on eraldi: kui muudad koolitundi, tee sama muudatus vajadusel ka siin.
      </p>

      {events.length ? (
        <div className="grid gap-4">
          {events.map((event, index) => (
            <EditorItem
              key={event.id}
              number={index + 1}
              title={event.title}
              onMoveUp={index > 0 ? () => onChange(moveItem(events, index, -1)) : undefined}
              onMoveDown={index < events.length - 1 ? () => onChange(moveItem(events, index, 1)) : undefined}
              onDelete={() => onChange(removeItem(events, index))}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DaySelect value={event.day} onChange={(day) => update(index, { ...event, day })} />
                <CategorySelect value={event.category} onChange={(category) => update(index, { ...event, category })} />
                <div className="md:col-span-2">
                  <TextField label="Pealkiri" value={event.title} onChange={(title) => update(index, { ...event, title })} />
                </div>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-3 border border-[#bdc9d1] bg-[#f8fafb] px-3 text-xs font-black text-[#526878] dark:border-[#29485f] dark:bg-[#091925] dark:text-[#b8c9d4]">
                <input
                  type="checkbox"
                  className="size-4 accent-[#245fae]"
                  checked={event.startMinute === null && event.endMinute === null}
                  onChange={(input) => update(index, input.target.checked
                    ? { ...event, startMinute: null, endMinute: null, flexible: true }
                    : { ...event, startMinute: 540, endMinute: 600, flexible: false })}
                />
                Paindlik aeg (täpset algust ja lõppu ei kuvata)
              </label>

              {(event.startMinute !== null || event.endMinute !== null) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TimeField label="Algus" value={event.startMinute} onChange={(startMinute) => update(index, { ...event, startMinute, flexible: false })} />
                  <TimeField label="Lõpp" value={event.endMinute} onChange={(endMinute) => update(index, { ...event, endMinute, flexible: false })} />
                </div>
              )}

              <TextAreaField label="Lisainfo" value={event.detail ?? ""} placeholder="Valikuline selgitus" onChange={(detail) => update(index, { ...event, detail })} />
            </EditorItem>
          ))}
        </div>
      ) : <EditorEmpty>Nädala sündmusi pole. Lisa esimene sündmus ülevalt.</EditorEmpty>}
    </section>
  );
}
