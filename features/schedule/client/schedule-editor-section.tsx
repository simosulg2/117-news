"use client";

import { useId, useState, type ReactNode } from "react";

import { AddButton, ItemActions } from "./schedule-editor-fields";

export function EditorSectionHeader({
  eyebrow, title, description, count, addLabel, onAdd,
}: {
  eyebrow: string;
  title: string;
  description: string;
  count?: number;
  addLabel?: string;
  onAdd?: () => void;
}) {
  return (
    <header className="mb-4 flex flex-col gap-3 border-b border-[#aebcc6] pb-4 dark:border-[#29485f] sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-black text-[#172634] dark:text-[#edf4f8]">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-[#617786] dark:text-[#8da1b0]">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {count !== undefined && <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#617786] dark:text-[#8da1b0]">{count} kirjet</span>}
        {addLabel && onAdd && <AddButton onClick={onAdd}>{addLabel}</AddButton>}
      </div>
    </header>
  );
}

export function EditorItem({
  number, title, children, onMoveUp, onMoveDown, onDelete,
}: {
  number: number;
  title: string;
  children: ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(number <= 2);
  return (
    <article className="border border-[#aebcc6] bg-white shadow-[3px_3px_0_#d5dee4] dark:border-[#29485f] dark:bg-[#0b1b29] dark:shadow-[3px_3px_0_#102538]">
      <header className="flex flex-col gap-2 border-b border-[#d5dee4] bg-[#eef3f6] px-3 py-2.5 dark:border-[#263d50] dark:bg-[#102538] sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left text-xs font-black text-[#172634] outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-[#edf4f8]"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="text-[#245fae] dark:text-signal">{String(number).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1 break-words">{title || "Pealkirjata kirje"}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.06em] text-[#617786] dark:text-[#9bb0bf]">{expanded ? "Sulge" : "Ava"}</span>
          <span aria-hidden="true" className="w-3 text-center text-sm">{expanded ? "−" : "+"}</span>
        </button>
        <ItemActions label={title || `${number}. kirje`} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} />
      </header>
      <div id={contentId} hidden={!expanded} className="grid gap-4 p-3 sm:p-4">{children}</div>
    </article>
  );
}
