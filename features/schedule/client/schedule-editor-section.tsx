"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

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

export function CompactEditorItem({
  number,
  title,
  summary,
  children,
  more,
  forceExpanded = false,
  forceMoreExpanded = false,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  number: number;
  title: string;
  summary?: string;
  children: ReactNode;
  more?: ReactNode;
  forceExpanded?: boolean;
  forceMoreExpanded?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(() => title.trim().toLocaleLowerCase("et").includes("uus "));
  const [moreExpanded, setMoreExpanded] = useState(false);
  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);
  useEffect(() => {
    if (forceMoreExpanded) setMoreExpanded(true);
  }, [forceMoreExpanded]);
  return (
    <article className={`border bg-white shadow-[2px_2px_0_#d5dee4] dark:bg-[#0b1b29] dark:shadow-[2px_2px_0_#102538] ${forceExpanded
      ? "border-[#9f3030] ring-2 ring-[#9f3030]/20 dark:border-[#f2a3a3]"
      : "border-[#aebcc6] dark:border-[#29485f]"
    }`}>
      <header className="flex items-center justify-between gap-3 border-b border-[#d5dee4] bg-[#eef3f6] px-3 py-2 dark:border-[#263d50] dark:bg-[#102538]">
        <button
          type="button"
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left text-xs font-black text-[#172634] outline-none focus-visible:ring-2 focus-visible:ring-signal dark:text-[#edf4f8]"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="text-[#245fae] dark:text-signal">{String(number).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1">
            <span className="block break-words">{title || "Pealkirjata kirje"}</span>
            {summary && <span className="mt-0.5 block text-[9px] font-bold text-[#617786] dark:text-[#9bb0bf]">{summary}</span>}
          </span>
          <span aria-hidden="true" className="shrink-0 text-base">{expanded ? "−" : "+"}</span>
        </button>
        {expanded && (
          <ItemActions
            label={title || `${number}. kirje`}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
          />
        )}
      </header>
      <div id={contentId} className={expanded ? "grid gap-3 p-3 sm:p-4" : "hidden"}>{children}</div>
      {more && expanded && (
        <details
          open={moreExpanded}
          onToggle={(event) => setMoreExpanded(event.currentTarget.open)}
          className="group border-t border-[#d5dee4] dark:border-[#263d50]"
        >
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-[10px] font-black uppercase tracking-[0.07em] text-[#526878] outline-none hover:bg-[#eef3f6] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:text-[#9bb0bf] dark:hover:bg-[#102538] sm:px-4">
            Rohkem valikuid
            <span aria-hidden="true" className="text-base group-open:rotate-45">+</span>
          </summary>
          <div className="grid gap-3 border-t border-[#d5dee4] bg-[#f8fafb] p-3 dark:border-[#263d50] dark:bg-[#091925] sm:p-4">
            {more}
          </div>
        </details>
      )}
    </article>
  );
}
