import type { ScheduleData, ScheduleDay, SchoolPeriod } from "@/lib/schedule-types";

import { SCHEDULE_DAYS } from "./schedule-formatters";

function dayLabel(day: ScheduleDay): string {
  return SCHEDULE_DAYS.find((item) => item.value === day)?.label ?? "—";
}

function sortedPeriods(periods: readonly SchoolPeriod[]): SchoolPeriod[] {
  return [...periods].sort((left, right) => left.day - right.day
    || left.timeWindow.localeCompare(right.timeWindow, "et")
    || left.period.localeCompare(right.period, "et"));
}

export function SchoolView({ data }: { data: ScheduleData }) {
  const periods = sortedPeriods(data.schoolPeriods);
  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Tunniplaan</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Kool</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Ained, kellaajad ja märkused ühe nädala lõikes.</p>
      </div>

      {periods.length ? (
        <>
          <div className="mt-4 grid gap-2 md:hidden">
            {periods.map((period) => (
              <article key={period.id} className="border border-[#bdc9d1] bg-white p-3 dark:border-[#29485f] dark:bg-[#0b1b29]">
                <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#245fae] dark:text-signal">
                  <span>{dayLabel(period.day)} · {period.period}</span>
                  <span className="tabular-nums">{period.timeWindow}</span>
                </div>
                <h3 className="mt-2 text-sm font-black text-[#172634] dark:text-[#edf4f8]">{period.subjectEt}</h3>
                <p className="mt-0.5 text-[11px] text-[#617786] dark:text-[#8da1b0]">{period.subjectEn}</p>
                {period.note && <p className="mt-2 border-t border-[#d5dee4] pt-2 text-[11px] text-[#526878] dark:border-[#263d50] dark:text-[#9bb0bf]">{period.note}</p>}
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto border border-[#aebcc6] md:block dark:border-[#29485f]">
            <table className="w-full min-w-[44rem] border-collapse text-left text-xs">
              <thead className="bg-[#102538] text-[10px] uppercase tracking-[0.08em] text-[#c7d5df]">
                <tr>
                  {['Päev', 'Tund', 'Aeg', 'Aine', 'English', 'Märkus'].map((label) => (
                    <th key={label} scope="col" className="border-r border-[#263d50] px-3 py-2 font-black last:border-r-0">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d5dee4] bg-white dark:divide-[#263d50] dark:bg-[#0b1b29]">
                {periods.map((period) => (
                  <tr key={period.id} className="hover:bg-[#f1f5f7] dark:hover:bg-[#0d2030]">
                    <th scope="row" className="px-3 py-2 font-black text-[#174b8d] dark:text-signal">{dayLabel(period.day)}</th>
                    <td className="px-3 py-2 font-bold text-[#526878] dark:text-[#9bb0bf]">{period.period}</td>
                    <td className="px-3 py-2 tabular-nums text-[#526878] dark:text-[#9bb0bf]">{period.timeWindow}</td>
                    <td className="px-3 py-2 font-bold text-[#172634] dark:text-[#edf4f8]">{period.subjectEt}</td>
                    <td className="px-3 py-2 text-[#617786] dark:text-[#8da1b0]">{period.subjectEn}</td>
                    <td className="px-3 py-2 text-[#617786] dark:text-[#8da1b0]">{period.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-4 border border-dashed border-[#9fb2c0] p-5 text-sm text-[#617786] dark:border-[#35536a] dark:text-[#9bb0bf]">Koolitunde pole lisatud.</p>
      )}
    </div>
  );
}
