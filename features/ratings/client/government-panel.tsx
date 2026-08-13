import { coalitionLabel } from "./ratings-formatters";

type GovernmentPanelProps = {
  governmentSeats: number;
  oppositionSeats: number;
  eesti200Support: number | null;
};

export function GovernmentPanel({
  governmentSeats,
  oppositionSeats,
  eesti200Support,
}: GovernmentPanelProps) {
  return (
    <section aria-labelledby="government-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
        <h2 id="government-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Valitsus vs ülejäänud</h2>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[#bdcad3] dark:divide-[#294154]">
        <div className="px-3 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#607583] dark:text-[#7890a2]">REF + E200</p>
          <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-[#245fae] dark:text-[#7db0ff]">{governmentSeats}</p>
          <p className="mt-2 text-xs font-semibold text-[#805818] dark:text-[#efb860]">{coalitionLabel(governmentSeats)}</p>
        </div>
        <div className="px-3 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#607583] dark:text-[#7890a2]">Ülejäänud</p>
          <p className="mt-1 text-4xl font-bold leading-none tabular-nums text-[#334957] dark:text-[#dce7ee]">{oppositionSeats}</p>
          <p className="mt-2 text-xs text-[#526878] dark:text-[#8da1b0]">projektsioonis</p>
        </div>
      </div>
      <div className="border-t border-[#bdcad3] px-3 py-2 text-[11px] leading-5 text-[#526878] dark:border-[#294154] dark:text-[#8da1b0]">
        Valitsusliit: Reformierakond ja Eesti 200. {eesti200Support === null
          ? "Eesti 200 reiting puudub praegusest küsitlusest."
          : eesti200Support < 5
            ? "Eesti 200 jääb praeguses küsitluses alla valimiskünnise."
            : "Mõlemad erakonnad ületavad praeguses küsitluses valimiskünnise."}
      </div>
    </section>
  );
}
