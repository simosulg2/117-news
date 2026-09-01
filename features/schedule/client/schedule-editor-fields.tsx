"use client";

import { useEffect, useId, useState } from "react";

import { SCHEDULE_CATEGORIES, type RoutineItem, type ScheduleCategory, type ScheduleDay } from "@/lib/schedule-types";

import { CATEGORY_LABELS, SCHEDULE_DAYS } from "./schedule-formatters";

const FIELD_CLASS = "mt-1.5 min-h-11 w-full border border-[#9fb2c0] bg-white px-3 py-2 text-sm font-bold text-[#172634] outline-none transition focus:border-[#245fae] focus:ring-2 focus:ring-[#245fae]/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#35536a] dark:bg-[#091925] dark:text-[#edf4f8] dark:focus:border-signal dark:focus:ring-signal/20";

function Label({ htmlFor, children, hint }: { htmlFor: string; children: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[10px] font-black uppercase tracking-[0.08em] text-[#526878] dark:text-[#9bb0bf]">
      {children}{hint && <span className="ml-1 normal-case tracking-normal text-[#7890a2]">{hint}</span>}
    </label>
  );
}

export function TextField({
  label, value, onChange, placeholder, maxLength = 160, hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <Label htmlFor={id} hint={hint}>{label}</Label>
      <input id={id} className={FIELD_CLASS} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function TextAreaField({
  label, value, onChange, placeholder, maxLength = 500,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <textarea id={id} rows={3} className={`${FIELD_CLASS} resize-y leading-5`} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export function DaySelect({ label = "Päev", value, onChange }: { label?: string; value: ScheduleDay; onChange: (value: ScheduleDay) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={FIELD_CLASS} value={value} onChange={(event) => onChange(Number(event.target.value) as ScheduleDay)}>
        {SCHEDULE_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
      </select>
    </div>
  );
}

export function OptionalDaySelect({ value, onChange }: { value: ScheduleDay | undefined; onChange: (value: ScheduleDay | undefined) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>Päev</Label>
      <select id={id} className={FIELD_CLASS} value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) as ScheduleDay : undefined)}>
        <option value="">Iga päev / määramata</option>
        {SCHEDULE_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
      </select>
    </div>
  );
}

export function CategorySelect({ value, onChange }: { value: ScheduleCategory; onChange: (value: ScheduleCategory) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>Kategooria</Label>
      <select id={id} className={FIELD_CLASS} value={value} onChange={(event) => onChange(event.target.value as ScheduleCategory)}>
        {SCHEDULE_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </select>
    </div>
  );
}

export function RoutineSectionSelect({ value, onChange }: { value: RoutineItem["section"]; onChange: (value: RoutineItem["section"]) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>Rutiini osa</Label>
      <select id={id} className={FIELD_CLASS} value={value} onChange={(event) => onChange(event.target.value as RoutineItem["section"])}>
        <option value="morning">Hommik</option>
        <option value="evening">Õhtu</option>
        <option value="fitness">Liikumine</option>
      </select>
    </div>
  );
}

export function NumberField({
  label, value, onChange, minimum, maximum, step = 0.5, nullable = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  minimum: number;
  maximum: number;
  step?: number;
  nullable?: boolean;
}) {
  const id = useId();
  const [raw, setRaw] = useState(value === null ? "" : String(value));
  useEffect(() => setRaw(value === null ? "" : String(value)), [value]);

  const commit = (input: string) => {
    if (!input.trim()) {
      const next = nullable ? null : minimum;
      setRaw(next === null ? "" : String(next));
      onChange(next);
      return;
    }
    const parsed = Number(input);
    const next = Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : minimum;
    setRaw(String(next));
    onChange(next);
  };

  return (
    <div>
      <Label htmlFor={id} hint={nullable ? "(valikuline)" : undefined}>{label}</Label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={FIELD_CLASS}
        value={raw}
        min={minimum}
        max={maximum}
        step={step}
        onChange={(event) => {
          const nextRaw = event.target.value;
          setRaw(nextRaw);
          if (nextRaw.trim() && Number.isFinite(Number(nextRaw))) {
            onChange(Math.min(maximum, Math.max(minimum, Number(nextRaw))));
          } else if (nullable) {
            onChange(null);
          }
        }}
        onBlur={(event) => commit(event.target.value)}
      />
    </div>
  );
}

export function ItemActions({
  label, onMoveUp, onMoveDown, onDelete,
}: {
  label: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
}) {
  const buttonClass = "min-h-9 border border-[#9fb2c0] bg-white px-2.5 text-[10px] font-black uppercase tracking-[0.05em] text-[#526878] outline-none hover:bg-[#edf3f7] focus-visible:ring-2 focus-visible:ring-signal disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#35536a] dark:bg-[#0b1b29] dark:text-[#b8c9d4] dark:hover:bg-[#102538]";
  return (
    <div className="flex flex-wrap justify-end gap-1.5" aria-label={`${label} toimingud`}>
      {onMoveUp && <button type="button" className={buttonClass} onClick={onMoveUp} aria-label={`${label}: liiguta üles`}>↑</button>}
      {onMoveDown && <button type="button" className={buttonClass} onClick={onMoveDown} aria-label={`${label}: liiguta alla`}>↓</button>}
      <button type="button" className={`${buttonClass} border-[#c98b8b] text-[#9f3030] dark:border-[#704449] dark:text-[#f2a3a3]`} onClick={onDelete}>Kustuta</button>
    </div>
  );
}

export function AddButton({ children, onClick }: { children: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="min-h-10 border border-[#245fae] bg-[#245fae] px-4 text-xs font-black text-white outline-none hover:bg-[#174b8d] focus-visible:ring-2 focus-visible:ring-signal dark:border-signal dark:bg-signal dark:text-[#07131f] dark:hover:bg-[#91dfef]">+ {children}</button>;
}

export function EditorEmpty({ children }: { children: string }) {
  return <p className="border border-dashed border-[#9fb2c0] bg-[#f8fafb] p-5 text-sm text-[#617786] dark:border-[#35536a] dark:bg-[#091925] dark:text-[#9bb0bf]">{children}</p>;
}
