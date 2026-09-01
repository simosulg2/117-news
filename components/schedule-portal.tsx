"use client";

import { useState } from "react";

import { BalanceView } from "@/features/schedule/client/balance-view";
import { RoutinesView } from "@/features/schedule/client/routines-view";
import { ScheduleCompactHeader } from "@/features/schedule/client/schedule-compact-header";
import { ScheduleEditor } from "@/features/schedule/client/schedule-editor";
import type { ScheduleEditorSection } from "@/features/schedule/client/schedule-editor-helpers";
import {
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
            <ScheduleCompactHeader
              title={schedule.title}
              subtitle={schedule.subtitle}
              activeTab={activeTab}
              canInvite={canInvite}
              initialInvites={initialInvites}
              onCreateInvite={onCreateInvite}
              onRevokeInvite={onRevokeInvite}
              onEdit={() => setEditing(true)}
            />

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
