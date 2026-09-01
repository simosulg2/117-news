"use client";

import { useState } from "react";

import { getTallinnSchedulePosition } from "@/features/schedule/model/schedule-events";
import { buildSchoolTimetable } from "@/features/schedule/model/school-timetable";
import type { ScheduleData, ScheduleDay, SchoolPeriod } from "@/lib/schedule-types";

import { SCHEDULE_DAYS } from "./schedule-formatters";

function dayLabel(day: ScheduleDay): string {
  return SCHEDULE_DAYS.find((item) => item.value === day)?.label ?? "—";
}

function schoolDayAt(now: Date | null): ScheduleDay {
  if (!now) return 1;
  const day = getTallinnSchedulePosition(now).day;
  return day <= 5 ? day : 1;
}

function SubjectCell({ periods }: { periods: readonly SchoolPeriod[] }) {
  if (!periods.length) {
    return <span aria-hidden="true" className="block min-h-20" />;
  }

  return (
    <div className="grid h-full divide-y divide-[#afcbd2] dark:divide-[#29485f]">
      {periods.map((period) => (
        <article key={period.id} className="flex min-h-20 flex-col items-center justify-center px-2 py-3 text-center">
          <h3 className="text-sm font-black leading-5 text-[#172634] dark:text-[#edf4f8] lg:text-base">
            {period.subjectEt}
          </h3>
          {period.note && (
            <p className="mt-2 max-w-44 border-t border-[#b8cfd6] pt-1.5 text-[10px] leading-4 text-[#526878] dark:border-[#35536a] dark:text-[#9bb0bf]">
              {period.note}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

export function SchoolView({ data, now }: { data: ScheduleData; now: Date | null }) {
  const timetable = buildSchoolTimetable(data.schoolPeriods);
  const [selectedDay, setSelectedDay] = useState<ScheduleDay>(() => schoolDayAt(now));
  const selectedRow = timetable.rows.find((row) => row.day === selectedDay) ?? timetable.rows[0];
  const selectedLessonCount = selectedRow?.cells.reduce((total, cell) => total + cell.length, 0) ?? 0;
  const lunchLabel = timetable.lunchWindows.join(" / ");

  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Tunniplaan</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Kool</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Päevad ridades, tunnid veergudes — nagu päris tunniplaanis.</p>
      </div>

      {timetable.columns.length ? (
        <>
          <div className="mt-4 md:hidden">
            <div className="grid grid-cols-5 border border-[#aebcc6] bg-[#aebcc6] dark:border-[#29485f] dark:bg-[#29485f]" role="group" aria-label="Vali koolipäev">
              {timetable.rows.map((row) => {
                const selected = row.day === selectedDay;
                const definition = SCHEDULE_DAYS.find((day) => day.value === row.day)!;
                return (
                  <button
                    key={row.day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedDay(row.day)}
                    className={`min-h-12 border-r border-[#aebcc6] text-sm font-black outline-none last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-signal dark:border-[#29485f] ${selected
                      ? "bg-[#102538] text-white dark:bg-signal dark:text-[#07131f]"
                      : "bg-white text-[#526878] hover:bg-[#edf3f7] dark:bg-[#0b1b29] dark:text-[#9bb0bf] dark:hover:bg-[#102538]"
                    }`}
                  >
                    <span aria-hidden="true">{definition.shortLabel}</span>
                    <span className="sr-only">{definition.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedRow && (
              <section className="border-x border-b border-[#aebcc6] bg-[#f8fafb] dark:border-[#29485f] dark:bg-[#091925]" aria-labelledby="mobile-school-day">
                <header className="flex items-center justify-between gap-3 border-b border-[#bdc9d1] bg-[#d9edf1] px-3 py-2.5 dark:border-[#29485f] dark:bg-[#102538]">
                  <h3 id="mobile-school-day" className="text-sm font-black text-[#172634] dark:text-[#edf4f8]">{dayLabel(selectedRow.day)}</h3>
                  <span className="text-[10px] font-black uppercase tracking-[0.08em] text-[#245fae] dark:text-signal">{selectedLessonCount} {selectedLessonCount === 1 ? "tund" : "tundi"}</span>
                </header>
                <ol className="divide-y divide-[#c5d7dc] dark:divide-[#29485f]">
                  {timetable.columns.map((column, index) => (
                    <li key={column.period}>
                      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] bg-white dark:bg-[#0b1b29]">
                        <div className="border-r border-[#c5d7dc] bg-[#e7f3f5] px-2 py-3 text-center dark:border-[#29485f] dark:bg-[#0d2433]">
                          <p className="text-xs font-black text-[#174b8d] dark:text-signal">{index + 1}</p>
                          <p className="mt-1 whitespace-nowrap text-[9px] font-bold tabular-nums text-[#617786] dark:text-[#8da1b0]">{column.timeWindow}</p>
                        </div>
                        <SubjectCell periods={selectedRow.cells[index]} />
                      </div>
                      {index === 1 && lunchLabel && (
                        <div className="flex items-center justify-between gap-3 border-t border-[#c7aa72] bg-[#f7ead2] px-3 py-2 text-[10px] font-black uppercase tracking-[0.07em] text-[#795516] dark:border-[#72582c] dark:bg-[#2b2417] dark:text-[#efc983]">
                          <span>Lõunapaus</span>
                          <span className="tabular-nums">{lunchLabel}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto border border-[#aebcc6] shadow-[4px_4px_0_#c8d4dc] md:block dark:border-[#29485f] dark:shadow-[4px_4px_0_#102538]">
            <div className="flex min-w-[60rem] items-center justify-between gap-4 border-b border-[#aebcc6] bg-[#d9edf1] px-4 py-2 dark:border-[#29485f] dark:bg-[#102538]">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#174b8d] dark:text-signal">Tööpäevade tunniplaan</p>
              {lunchLabel && <p className="text-[10px] font-bold text-[#617786] dark:text-[#9bb0bf]">Lõunapaus <span className="ml-1 tabular-nums text-[#172634] dark:text-[#edf4f8]">{lunchLabel}</span></p>}
            </div>
            <table className="w-full min-w-[60rem] table-fixed border-collapse text-left text-xs">
              <caption className="sr-only">Kooli tunniplaan esmaspäevast reedeni</caption>
              <thead className="bg-[#102538] text-[#c7d5df]">
                <tr>
                  <th scope="col" className="w-28 border-r border-[#29485f] px-3 py-3 text-[10px] font-black uppercase tracking-[0.1em]">Päev</th>
                  {timetable.columns.map((column, index) => (
                    <th key={column.period} scope="col" className="border-r border-[#29485f] px-2 py-2.5 text-center last:border-r-0">
                      <span className="block text-sm font-black text-white">{column.period}</span>
                      <span className="mt-0.5 block text-[10px] font-bold tabular-nums text-[#b8c9d4]">{column.timeWindow}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timetable.rows.map((row, rowIndex) => (
                  <tr key={row.day} className="border-t border-[#aebcc6] first:border-t-0 dark:border-[#29485f]">
                    <th scope="row" className="border-r border-[#aebcc6] bg-white px-3 py-4 text-center dark:border-[#29485f] dark:bg-[#091925]">
                      <span className="block text-3xl font-black leading-none text-[#174b8d] dark:text-signal">{SCHEDULE_DAYS.find((day) => day.value === row.day)?.shortLabel}</span>
                      <span className="mt-2 block text-[9px] font-black uppercase tracking-[0.06em] text-[#617786] dark:text-[#8da1b0]">{dayLabel(row.day)}</span>
                    </th>
                    {row.cells.map((cell, columnIndex) => (
                      <td
                        key={`${row.day}-${timetable.columns[columnIndex].period}`}
                        className={`h-32 border-r border-[#aebcc6] align-middle last:border-r-0 dark:border-[#29485f] ${
                          (rowIndex + columnIndex) % 2 === 0
                            ? "bg-[#d9edf1] dark:bg-[#0d2433]"
                            : "bg-[#c9e5eb] dark:bg-[#0b1b29]"
                        }`}
                      >
                        <SubjectCell periods={cell} />
                      </td>
                    ))}
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
