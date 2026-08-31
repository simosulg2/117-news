import { deriveStudyTotals } from "@/features/schedule/model/schedule-metrics";
import type { ScheduleData, ScheduleDay, StudyPlan } from "@/lib/schedule-types";

import { formatHours, SCHEDULE_DAYS } from "./schedule-formatters";

function dayLabel(day: ScheduleDay): string {
  return SCHEDULE_DAYS.find((item) => item.value === day)?.label ?? "—";
}

function sortedPlans(plans: readonly StudyPlan[]): StudyPlan[] {
  return [...plans].sort((left, right) => left.day - right.day
    || left.window.localeCompare(right.window, "et")
    || left.focus.localeCompare(right.focus, "et"));
}

export function StudyView({ data }: { data: ScheduleData }) {
  const totals = deriveStudyTotals(data.studyPlans);
  const plans = sortedPlans(data.studyPlans);
  const completionWidth = Math.min(100, Math.max(0, totals.completionPercent));
  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Nädala koormus</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Õppimine</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Planeeritud aeg, tegelik panus ja fookus.</p>
      </div>

      <div className="mt-4 grid gap-px border border-[#aebcc6] bg-[#aebcc6] sm:grid-cols-3 dark:border-[#29485f] dark:bg-[#29485f]">
        {[
          ["Planeeritud", formatHours(totals.maxHours)],
          ["Tehtud", formatHours(totals.actualHours)],
          ["Jäänud", formatHours(totals.remainingHours)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white p-4 dark:bg-[#0b1b29]">
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#617786] dark:text-[#7890a2]">{label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-[#172634] dark:text-[#edf4f8]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 border border-[#bdc9d1] bg-white p-3 dark:border-[#29485f] dark:bg-[#0b1b29]">
        <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-[#526878] dark:text-[#9bb0bf]">
          <span>{totals.trackedPlanCount}/{totals.totalPlanCount} plaani jälgitud</span>
          <span className="tabular-nums text-[#245fae] dark:text-signal">{totals.completionPercent}%</span>
        </div>
        <div className="mt-2 h-2 border border-[#9fb2c0] bg-[#dfe8ee] dark:border-[#35536a] dark:bg-[#102538]" aria-hidden="true">
          <div className="h-full bg-[#245fae] dark:bg-signal" style={{ width: `${completionWidth}%` }} />
        </div>
      </div>

      {plans.length ? (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.id} className="border border-[#bdc9d1] bg-white p-3 dark:border-[#29485f] dark:bg-[#0b1b29]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#245fae] dark:text-signal">{dayLabel(plan.day)} · {plan.window}</p>
                <p className="text-[10px] font-bold text-[#617786] dark:text-[#8da1b0]">
                  {plan.actualHours === null ? "Tegelik aeg —" : `${formatHours(plan.actualHours)} / ${formatHours(plan.maxHours)}`}
                </p>
              </div>
              <h3 className="mt-2 text-sm font-black text-[#172634] dark:text-[#edf4f8]">{plan.focus || "Vaba fookus"}</h3>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                {plan.difficulty && <span className="border border-[#c5d0d7] px-2 py-1 text-[#526878] dark:border-[#35536a] dark:text-[#9bb0bf]">{plan.difficulty}</span>}
                {plan.status && <span className="border border-[#c5d0d7] px-2 py-1 text-[#526878] dark:border-[#35536a] dark:text-[#9bb0bf]">{plan.status}</span>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 border border-dashed border-[#9fb2c0] p-5 text-sm text-[#617786] dark:border-[#35536a] dark:text-[#9bb0bf]">Õppeplaane pole lisatud.</p>
      )}
    </div>
  );
}
