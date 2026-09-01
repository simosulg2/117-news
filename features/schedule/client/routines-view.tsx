import type { RoutineItem, ScheduleData, ScheduleDay } from "@/lib/schedule-types";

import { CATEGORY_ACCENTS, SCHEDULE_DAYS } from "./schedule-formatters";

const WORKDAY_SECTIONS: ReadonlyArray<{
  id: Extract<RoutineItem["section"], "morning" | "evening">;
  label: string;
  description: string;
}> = [
  { id: "morning", label: "Hommik", description: "Ärkamisest väljumiseni" },
  { id: "evening", label: "Õhtu", description: "Koju jõudmisest uneni" },
];

function SectionHeader({
  headingId,
  number,
  eyebrow,
  title,
  description,
}: {
  headingId: string;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="grid gap-3 border-b border-[#29485f] bg-[#102538] px-4 py-3 text-white sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:items-center dark:border-[#35536a]">
      <span className="flex size-9 items-center justify-center border border-[#527189] text-xs font-black tabular-nums text-signal" aria-hidden="true">{number}</span>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#a9bdca]">{eyebrow}</p>
        <h3 id={headingId} className="mt-0.5 text-base font-black">{title}</h3>
        <p className="mt-0.5 text-[11px] text-[#b8c9d4]">{description}</p>
      </div>
    </header>
  );
}

function RoutineSteps({ items }: { items: readonly RoutineItem[] }) {
  if (!items.length) {
    return <p className="p-4 text-xs text-[#617786] dark:text-[#8da1b0]">Selles osas pole samme.</p>;
  }

  return (
    <ol className="divide-y divide-[#d5dee4] bg-white dark:divide-[#263d50] dark:bg-[#0b1b29]">
      {items.map((item, index) => (
        <li key={item.id} className={`grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-l-4 px-3 py-3.5 sm:grid-cols-[2.25rem_7rem_minmax(0,1fr)] sm:items-start ${CATEGORY_ACCENTS[item.category]}`}>
          <span className="flex size-8 items-center justify-center border border-[#9fb2c0] bg-[#eef3f6] text-xs font-black tabular-nums text-[#174b8d] dark:border-[#35536a] dark:bg-[#102538] dark:text-signal" aria-label={`${index + 1}. samm`}>
            {index + 1}
          </span>
          <p className="col-start-2 row-start-1 text-[11px] font-black tabular-nums text-[#245fae] dark:text-signal sm:col-start-2 sm:pt-1.5">
            {item.timeWindow}
          </p>
          <div className="col-start-2 sm:col-start-3 sm:row-start-1">
            <h4 className="text-sm font-black text-[#172634] dark:text-[#edf4f8]">{item.title}</h4>
            {item.details && <p className="mt-1 text-[11px] leading-5 text-[#617786] dark:text-[#8da1b0]">{item.details}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MovementDay({ day, items }: { day: ScheduleDay | null; items: readonly RoutineItem[] }) {
  const definition = day === null ? null : SCHEDULE_DAYS.find((candidate) => candidate.value === day);
  const headingId = `movement-day-${day ?? "flexible"}`;
  return (
    <section className="grid border-t border-[#bdc9d1] first:border-t-0 md:grid-cols-[9rem_minmax(0,1fr)] dark:border-[#29485f]" aria-labelledby={headingId}>
      <header className="flex items-center gap-3 bg-[#e7f0f4] px-3 py-3 md:block md:border-r md:border-[#bdc9d1] md:py-4 dark:bg-[#0d2030] md:dark:border-[#29485f]">
        <span className="flex size-8 shrink-0 items-center justify-center border border-[#9fb2c0] bg-white text-xs font-black text-[#174b8d] dark:border-[#35536a] dark:bg-[#0b1b29] dark:text-signal" aria-hidden="true">
          {definition?.shortLabel ?? "•"}
        </span>
        <div>
          <h4 id={headingId} className="text-xs font-black text-[#172634] md:mt-2 dark:text-[#edf4f8]">{definition?.label ?? "Paindlik"}</h4>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.07em] text-[#617786] dark:text-[#7890a2]">Liikumine</p>
        </div>
      </header>
      <div className="divide-y divide-[#d5dee4] bg-white dark:divide-[#263d50] dark:bg-[#0b1b29]">
        {items.map((item) => (
          <article key={item.id} className={`grid gap-1 border-l-4 px-3 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3 ${CATEGORY_ACCENTS[item.category]}`}>
            <p className="text-[11px] font-black tabular-nums text-[#245fae] dark:text-signal">{item.timeWindow}</p>
            <div>
              <h5 className="text-sm font-black text-[#172634] dark:text-[#edf4f8]">{item.title}</h5>
              {item.details && <p className="mt-1 text-[11px] leading-5 text-[#617786] dark:text-[#8da1b0]">{item.details}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RoutinesView({ data }: { data: ScheduleData }) {
  const movementItems = data.routines.filter((item) => item.section === "fitness");
  const movementDays = SCHEDULE_DAYS
    .filter((day) => movementItems.some((item) => item.day === day.value))
    .map((day) => ({ day: day.value, items: movementItems.filter((item) => item.day === day.value) }));
  const flexibleMovement = movementItems.filter((item) => !item.day);

  return (
    <div>
      <div className="border-b border-[#aebcc6] pb-3 dark:border-[#29485f]">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#245fae] dark:text-signal">Päeva järjekord</p>
        <h2 className="mt-1 text-2xl font-black text-[#172634] dark:text-[#edf4f8]">Rutiinid</h2>
        <p className="mt-1 text-xs text-[#617786] dark:text-[#8da1b0]">Tööpäev on sammudena; liikumine on eraldi päevade kaupa.</p>
      </div>

      <div className="mt-4 grid gap-5">
        <section className="border border-[#aebcc6] bg-[#f8fafb] shadow-[4px_4px_0_#c8d4dc] dark:border-[#29485f] dark:bg-[#091925] dark:shadow-[4px_4px_0_#102538]" aria-labelledby="routine-workday">
          <SectionHeader
            headingId="routine-workday"
            number="01"
            eyebrow="Esmaspäev–reede"
            title="Tööpäeva rütm"
            description="Loe ülevalt alla: kõigepealt hommik, seejärel õhtu."
          />
          {WORKDAY_SECTIONS.map((section) => {
            const items = data.routines.filter((item) => item.section === section.id);
            return (
              <section key={section.id} className="grid border-t border-[#bdc9d1] first:border-t-0 md:grid-cols-[9rem_minmax(0,1fr)] dark:border-[#29485f]" aria-labelledby={`routine-${section.id}`}>
                <header className="bg-[#e7f0f4] px-3 py-3 md:border-r md:border-[#bdc9d1] md:py-4 dark:bg-[#0d2030] md:dark:border-[#29485f]">
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#245fae] dark:text-signal">Tööpäeviti</p>
                  <h4 id={`routine-${section.id}`} className="mt-1 text-base font-black text-[#172634] dark:text-[#edf4f8]">{section.label}</h4>
                  <p className="mt-1 text-[10px] leading-4 text-[#617786] dark:text-[#8da1b0]">{section.description}</p>
                </header>
                <RoutineSteps items={items} />
              </section>
            );
          })}
        </section>

        <section className="border border-[#aebcc6] bg-[#f8fafb] shadow-[4px_4px_0_#c8d4dc] dark:border-[#29485f] dark:bg-[#091925] dark:shadow-[4px_4px_0_#102538]" aria-labelledby="routine-movement">
          <SectionHeader
            headingId="routine-movement"
            number="02"
            eyebrow="Nädala kaupa"
            title="Liikumise plaan"
            description="Iga trenn on oma päeva all; kellaaeg ja tegevus on ühel real."
          />
          {movementDays.length || flexibleMovement.length ? (
            <div>
              {movementDays.map((group) => <MovementDay key={group.day} day={group.day} items={group.items} />)}
              {flexibleMovement.length > 0 && <MovementDay day={null} items={flexibleMovement} />}
            </div>
          ) : (
            <p className="p-4 text-xs text-[#617786] dark:text-[#8da1b0]">Liikumise kirjeid pole lisatud.</p>
          )}
        </section>
      </div>
    </div>
  );
}
