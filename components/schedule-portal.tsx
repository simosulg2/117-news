"use client";

import { useState } from "react";

import { BalanceView } from "@/features/schedule/client/balance-view";
import { RoutinesView } from "@/features/schedule/client/routines-view";
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
  canSignOut: boolean;
  onSignOut: () => Promise<void>;
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
    case "school": return <SchoolView data={data} />;
    case "routines": return <RoutinesView data={data} />;
    case "balance": return <BalanceView data={data} />;
  }
}

export function SchedulePortal({ data, canSignOut, onSignOut }: SchedulePortalProps) {
  const { theme, toggleTheme } = usePageTheme();
  const now = useClock(15_000);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("today");

  return (
    <SchedulePageFrame
      theme={theme}
      now={now}
      dataConfigured={data !== null}
      canSignOut={canSignOut}
      onSignOut={onSignOut}
      onToggleTheme={toggleTheme}
    >
      <main id="schedule-main" tabIndex={-1} className="mx-auto w-full max-w-[96rem] flex-1 px-3 pb-12 pt-5 outline-none sm:px-5 lg:px-7">
        {data ? (
          <>
            <header className="mb-5 grid gap-4 border border-[#aebcc6] bg-white p-4 shadow-[4px_4px_0_#c8d4dc] dark:border-[#29485f] dark:bg-[#0b1b29] dark:shadow-[4px_4px_0_#102538] md:grid-cols-[minmax(0,1fr)_auto] md:items-end sm:p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#245fae] dark:text-signal">117.ee · Privaatne töölaud</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-[#101a24] dark:text-[#edf4f8] sm:text-3xl">{data.title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526878] dark:text-[#9bb0bf]">{data.subtitle}</p>
              </div>
              <dl className="grid grid-cols-3 gap-px border border-[#c5d0d7] bg-[#c5d0d7] text-center dark:border-[#263d50] dark:bg-[#263d50]">
                <div className="bg-[#f6f8f9] px-3 py-2 dark:bg-[#0d2030]">
                  <dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">Koolipäevi</dt>
                  <dd className="mt-0.5 text-sm font-black text-[#172634] dark:text-[#edf4f8]">5</dd>
                </div>
                <div className="bg-[#f6f8f9] px-3 py-2 dark:bg-[#0d2030]">
                  <dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">Ainetunde</dt>
                  <dd className="mt-0.5 text-sm font-black tabular-nums text-[#172634] dark:text-[#edf4f8]">
                    {data.schoolPeriods.filter((period) => period.period !== "Lõunapaus").length}
                  </dd>
                </div>
                <div className="bg-[#f6f8f9] px-3 py-2 dark:bg-[#0d2030]">
                  <dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#617786] dark:text-[#7890a2]">Ajavöönd</dt>
                  <dd className="mt-0.5 text-sm font-black text-[#172634] dark:text-[#edf4f8]">Eesti</dd>
                </div>
              </dl>
            </header>

            <ScheduleTabs activeTab={activeTab} onChange={setActiveTab} />
            <ScheduleTabPanel tab={activeTab}>
              <ActiveView tab={activeTab} data={data} now={now} />
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
