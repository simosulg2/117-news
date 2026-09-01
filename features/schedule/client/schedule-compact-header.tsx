"use client";

import { useState } from "react";

import {
  ScheduleInvitePanel,
  type CreateScheduleInviteResult,
  type ScheduleInviteItem,
} from "./schedule-invite-panel";
import type { ScheduleTab } from "./schedule-tabs";

type ScheduleCompactHeaderProps = {
  title: string;
  subtitle: string;
  activeTab: ScheduleTab;
  canInvite: boolean;
  initialInvites: readonly ScheduleInviteItem[];
  onCreateInvite: () => Promise<CreateScheduleInviteResult>;
  onRevokeInvite: (inviteId: string) => Promise<boolean>;
  onEdit: () => void;
};

function editLabel(tab: ScheduleTab): string {
  if (tab === "routines") return "Muuda rutiine";
  if (tab === "balance") return "Muuda tasakaalu";
  return "Muuda plaani";
}

export function ScheduleCompactHeader({
  title,
  subtitle,
  activeTab,
  canInvite,
  initialInvites,
  onCreateInvite,
  onRevokeInvite,
  onEdit,
}: ScheduleCompactHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="mb-3 border border-[#aebcc6] bg-white shadow-[3px_3px_0_#c8d4dc] dark:border-[#29485f] dark:bg-[#0b1b29] dark:shadow-[3px_3px_0_#102538]">
      <div className="flex min-h-12 items-stretch">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="schedule-header-details"
          aria-label={open ? "Peida ajakava info" : "Näita ajakava infot ja kutseid"}
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 text-left outline-none hover:bg-[#eef3f6] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:hover:bg-[#102538] sm:px-4"
        >
          <span className="min-w-0 truncate text-xs font-black text-[#172634] dark:text-[#edf4f8] sm:text-sm">{title}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#617786] dark:text-[#9bb0bf]">
            <span className="hidden sm:inline">{open ? "Peida" : canInvite ? "Info ja kutsed" : "Info"}</span>
            <span aria-hidden="true" className={`text-base transition-transform ${open ? "rotate-45" : ""}`}>+</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 border-l border-[#245fae] bg-[#245fae] px-3 text-[10px] font-black text-white outline-none hover:bg-[#174b8d] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-signal dark:bg-signal dark:text-[#07131f] sm:px-4 sm:text-[11px]"
        >
          {editLabel(activeTab)}
        </button>
      </div>
      {open && (
        <div id="schedule-header-details" className="border-t border-[#d5dee4] bg-[#f8fafb] p-3 dark:border-[#263d50] dark:bg-[#091925] sm:p-4">
          {subtitle && <p className="max-w-3xl text-xs leading-5 text-[#526878] dark:text-[#9bb0bf]">{subtitle}</p>}
          {canInvite && (
            <div className={subtitle ? "mt-3 border-t border-[#d5dee4] pt-3 dark:border-[#263d50]" : ""}>
              <ScheduleInvitePanel
                initialInvites={initialInvites}
                onCreateInvite={onCreateInvite}
                onRevokeInvite={onRevokeInvite}
              />
            </div>
          )}
        </div>
      )}
    </header>
  );
}
