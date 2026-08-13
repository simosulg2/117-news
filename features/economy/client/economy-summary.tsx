import type { EconomyResponse } from "@/lib/economy-types";

type EconomySummaryProps = {
  data: EconomyResponse;
};

export function EconomySummary({ data }: EconomySummaryProps) {
  const items = [
    { label: "Paranenud", value: data.summary.improved, className: "text-[#107052] dark:text-[#55d6b2]" },
    { label: "Halvenenud", value: data.summary.worsened, className: "text-[#a02d28] dark:text-[#ff7d76]" },
    { label: "Neutraalne", value: data.summary.neutral, className: "text-[#526878] dark:text-[#a9b7c2]" },
    { label: "Puudub", value: data.summary.unavailable, className: "text-[#805818] dark:text-[#efb860]" },
  ];
  return (
    <section aria-labelledby="economy-summary-title" className="mb-4 border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="border-b border-[#9fb2c0] bg-[#dfe8ee] px-3 py-2 dark:border-[#35536a] dark:bg-[#0d2030]">
        <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#7890a2]">Aastavõrdlus</p>
        <h1 id="economy-summary-title" className="mt-0.5 font-display text-lg font-bold text-[#172b3b] dark:text-[#e8f0f6] sm:text-xl">
          Eesti majandus võrreldes aastatagusega
        </h1>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(18rem,1.5fr)]">
        {items.map((item) => (
          <div key={item.label} className="border-b border-r border-[#c1ced7] px-3 py-3 dark:border-[#29465d] lg:border-b-0">
            <p className={`font-display text-3xl font-bold leading-none tabular-nums ${item.className}`}>{item.value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#7890a2]">{item.label}</p>
          </div>
        ))}
        <div className="col-span-2 px-3 py-3 text-[11px] leading-5 text-[#526878] dark:text-[#9aabb7] lg:col-span-1">
          <b className="text-[#172b3b] dark:text-[#dce8f0]">{data.summary.considered} näitajat.</b> {data.summary.methodology}
        </div>
      </div>
    </section>
  );
}
