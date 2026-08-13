import type { RatingsResponse } from "@/lib/ratings-types";

import { dateTimeFormatter } from "./ratings-formatters";

type MethodologyPanelProps = {
  data: RatingsResponse;
};

const linkClassName = "font-semibold underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:hover:text-[#7db0ff]";

export function MethodologyPanel({ data }: MethodologyPanelProps) {
  return (
    <section aria-labelledby="method-heading" className="mt-3 grid gap-3 border border-[#9fb2c0] bg-[#f4f7f9] p-3 text-xs leading-5 text-[#526878] dark:border-[#35536a] dark:bg-[#0a1926] dark:text-[#8da1b0] md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.45fr)]">
      <div>
        <h2 id="method-heading" className="font-bold text-[#192630] dark:text-[#e5eef4]">Kuidas projektsioon sünnib?</h2>
        <p className="mt-1">
          Kohtade hinnang kasutab üleriigilist toetust, 5% valimiskünnist ja Eesti modifitseeritud D’Hondti jagajaid 1, 2<sup>0,9</sup>, 3<sup>0,9</sup> … Täpselt 5% läheb arvesse. Kõik 101 kohta jaotatakse nimega erakondade vahel, mis künnise ületavad; kategooria „muu“ ja üksikkandidaadid mudelis kohti ei saa. Tegemist ei ole ametliku valimistulemuse ega ennustusega: tegelik jaotus sõltub 12 ringkonnast, kandidaatidest ning isiku- ja ringkonnamandaatidest, sealhulgas üksikkandidaadi võimalikust isikumandaadist.
        </p>
      </div>
      <div className="border-t border-[#bdcad3] pt-2 dark:border-[#294154] md:border-l md:border-t-0 md:pl-3 md:pt-0">
        <p><b className="text-[#304654] dark:text-[#c2d0d9]">Allikas:</b> {data.poll.source.label}</p>
        <p><b className="text-[#304654] dark:text-[#c2d0d9]">Loetud:</b> {dateTimeFormatter.format(new Date(data.fetchedAt)).replace(",", "")}</p>
        {data.sourceUpdatedAt && <p><b className="text-[#304654] dark:text-[#c2d0d9]">Allikas uuendatud:</b> {dateTimeFormatter.format(new Date(data.sourceUpdatedAt)).replace(",", "")}</p>}
        <div className="mt-1 flex flex-wrap gap-x-3">
          <a href={data.poll.source.publisherUrl} target="_blank" rel="noopener noreferrer external" className={linkClassName}>Reitingud.ee</a>
          <a href={data.poll.source.documentationUrl} target="_blank" rel="noopener noreferrer external" className={linkClassName}>Andmed</a>
          <a href={data.poll.source.methodologyUrl} target="_blank" rel="noopener noreferrer external" className={linkClassName}>Metoodika</a>
          <a href="https://www.valimised.ee/et/valimiste-meelespea/tulemuste-kindlakstegemine/valimistulemuste-kindlakstegemine-riigikogu" target="_blank" rel="noopener noreferrer external" className={linkClassName}>Ametlik valimiskord</a>
        </div>
        <div className="mt-2 border-t border-[#bdcad3] pt-2 dark:border-[#294154]">
          <a href="https://emor.ee/erakondade-toetusreitingud/" className="font-bold text-[#405767] underline decoration-[#8194a1] underline-offset-2 hover:text-[#245fae] focus-visible:ring-1 focus-visible:ring-signal dark:text-[#a9b7c2] dark:hover:text-[#7db0ff]">
            Kantar Emori kuureiting →
          </a>
          <p className="mt-0.5">Eraldi metoodika; Emori tulemusi ei kasutata siin kohtade projektsioonis.</p>
        </div>
      </div>
    </section>
  );
}
