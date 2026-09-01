"use client";

import { useState } from "react";

import { BalanceView } from "@/features/schedule/client/balance-view";
import { RoutinesView } from "@/features/schedule/client/routines-view";
import { ScheduleEditor } from "@/features/schedule/client/schedule-editor";
import type { ScheduleEditorSection } from "@/features/schedule/client/schedule-editor-helpers";
import {
  ScheduleInvitePanel,
  type CreateScheduleInviteResult,
  type ScheduleInviteItem,
} from "@/features/schedule/client/schedule-invite-panel";
import { SchedulePageFrame } from "@/features/schedule/client/schedule-page-frame";
import {
  ScheduleTabPanel,
  ScheduleTabs,
  type ScheduleTab,
} from "@/features/schedule/client/schedule-tabs";
import { SchoolView } from "@/features/schedule/client/school-view";
import { TodayView } from "@/features/schedule/client/today-view";
import { WeekView } from "@/features/schedule/client/week-view";
import { useClock } from "@/features/shell/client/use-clock";
import { usePageTheme } from "@/features/shell/client/use-page-theme";
import type { ScheduleData } from "@/lib/schedule-types";

type SchedulePortalProps = {
  data: ScheduleData | null;
  revision: number | null;
  canSignOut: boolean;
  canInvite: boolean;
  onSignOut: () => Promise<void>;
  onSave: (
    data: ScheduleData,
    expectedRevision: number,
  ) => Promise<
    | Readonly<{ ok: true; revision: number }>
    | Readonly<{
      ok: false;
      error: "conflict" | "invalid" | "unavailable";
      revision?: number;
    }>
  >;
  onCreateInvite: () => Promise<CreateScheduleInviteResult>;
  initialInvites: readonly ScheduleInviteItem[];
  onRevokeInvite: (inviteId: string) => Promise<boolean>;
};

function ActiveView({
  tab,
  data,
  now,
}: {
  tab: ScheduleTab;
  data: ScheduleData;
  now: Date | null;
}) {
  switch (tab) {
    case "today": return <TodayView data={data} now={now} />;
    case "week": return <WeekView data={data} now={now} />;
    case "school": return <SchoolView data={data} now={now} />;
    case "routines": return <RoutinesView data={data} />;
    case "balance": return <BalanceView data={data} />;
  }
}

function editorSectionForTab(tab: ScheduleTab): ScheduleEditorSection {
  if (tab === "routines") return "routines";
  if (tab === "balance") return "balance";
  return "events";
}

export function SchedulePortal({
  data,
  revision: initialRevision,
  canSignOut,
  canInvite,
  onSignOut,
  onSave,
  onCreateInvite,
  initialInvites,
  onRevokeInvite,
}: SchedulePortalProps) {
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock(15_000);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("today");
  const [schedule, setSchedule] = useState(data);
  const [revision, setRevision] = useState(initialRevision);
  const [editing, setEditing] = useState(false);

  async function saveSchedule(nextData: ScheduleData): Promise<void> {
    if (revision === null) throw new Error("Ajakava salvestus pole praegu saadaval.");
    const result = await onSave(nextData, revision);
    if (!result.ok) {
      if (result.error === "conflict") {
        if (result.revision !== undefined) setRevision(result.revision);
        throw new Error("Ajakava muudeti vahepeal teises aknas. Sinu sisestus on alles; vajuta uuesti „Salvesta”, kui soovid oma versiooni teadlikult peale kirjutada.");
      }
      if (result.error === "invalid") {
        throw new Error("Mõni ajakava väli ei ole kehtiv. Kontrolli sisestatud väärtusi.");
      }
      throw new Error("Ajakava salvestamine pole praegu saadaval.");
    }
    setSchedule(nextData);
    setRevision(result.revision);
  }

  return (
    <SchedulePageFrame
      theme={theme}
      now={now}
      dataConfigured={schedule !== null}
      canSignOut={canSignOut}
      onSignOut={onSignOut}
      onToggleTheme={toggleTheme}
    >
      <main id="schedule-main" tabIndex={-1} className="mx-auto w-full max-w-[96rem] flex-1 px-3 pb-12 pt-5 outline-none sm:px-5 lg:px-7">
        {schedule ? editing ? (
          <ScheduleEditor
            data={schedule}
            initialSection={editorSectionForTab(activeTab)}
            onSave={saveSchedule}
            onClose={() => setEditing(false)}
          />
        ) : (
          <>
            <header className="mb-5 border border-[#aebcc6] bg-white p-4 shadow-[4px_4px_0_#c8d4dc] dark:border-[#29485f] dark:bg-[#0b1b29] dark:shadow-[4px_4px_0_#102538] sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#245fae] dark:text-signal">117.ee · Privaatne töölaud</p>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-[#101a24] dark:text-[#edf4f8] sm:text-3xl">{schedule.title}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526878] dark:text-[#9bb0bf]">{schedule.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="min-h-10 shrink-0 border border-[#245fae] bg-[#245fae] px-4 text-[11px] font-black text-white outline-none hover:bg-[#174b8d] focus-visible:ring-2 focus-visible:ring-signal dark:border-signal dark:bg-signal dark:text-[#07131f]"
                >
                  {activeTab === "routines"
                    ? "Muuda rutiine"
                    : activeTab === "balance" ? "Muuda tasakaalu" : "Muuda plaani"}
                </button>
              </div>
              {canInvite && (
                <div className="mt-4 border-t border-[#d5dee4] pt-4 dark:border-[#263d50]">
                  <ScheduleInvitePanel
                    initialInvites={initialInvites}
                    onCreateInvite={onCreateInvite}
                    onRevokeInvite={onRevokeInvite}
                  />
                </div>
              )}
            </header>

            <ScheduleTabs activeTab={activeTab} onChange={setActiveTab} />
            <ScheduleTabPanel tab={activeTab}>
              <ActiveView tab={activeTab} data={schedule} now={now} />
            </ScheduleTabPanel>
          </>
        ) : (
          <section className="mx-auto mt-8 max-w-3xl border border-[#9d762f] bg-[#f7ead2] p-5 shadow-[4px_4px_0_#d8c39d] dark:border-[#9d762f] dark:bg-[#2b2417] dark:shadow-[4px_4px_0_#17130d] sm:p-7" aria-labelledby="schedule-unavailable-title">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#795516] dark:text-[#efc983]">Sisselogimine õnnestus</p>
            <h1 id="schedule-unavailable-title" className="mt-2 text-2xl font-black text-[#3d2d12] dark:text-[#f5dfb4]">Ajakava andmed pole seadistatud</h1>
            <p className="mt-3 text-sm leading-6 text-[#67460f] dark:text-[#d8ba7f]">
              Privaatne vaade töötab, kuid selle keskkonna ajakava sisu ei saa praegu avada. Proovi pärast serveri seadistamist uuesti.
            </p>
          </section>
        )}
      </main>
    </SchedulePageFrame>
  );
}
