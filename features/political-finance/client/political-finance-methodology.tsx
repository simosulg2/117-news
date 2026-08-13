import type { PoliticalFinanceSource } from "../../../lib/political-finance-types";

export function PoliticalFinanceMethodology({ source }: { source: PoliticalFinanceSource }) {
  return (
    <aside className="mt-3 border border-[#9fb2c0] bg-[#e8eef2] px-3 py-3 text-[11px] leading-5 text-[#526878] dark:border-[#35536a] dark:bg-[#0b1b29] dark:text-[#8da1b0]">
      <h2 className="font-bold text-[#193b56] dark:text-[#d7e3eb]">Kuidas seda vaadet lugeda</h2>
      <div className="mt-1 grid gap-2 md:grid-cols-3">
        <p><b>Allikafakt:</b> summad, nimed, kategooriad ja kuupäevad on ERJK avalikest kvartaliaruannetest. ERJK API ei anna eraldi avaldamise kellaaega, seega näitame aruandeperioodi ja 117.ee tõmbamise aega.</p>
        <p><b>Tuletatud näitaja:</b> viie suurima annetaja osakaal = nende sama kvartali annetuste summa / kõik sama kvartali annetused. See ei hinda annetuse mõju ega motiivi.</p>
        <p><b>Parandused:</b> erakonna ja perioodi püsiv kirje värskendatakse uue revisjonina. Detailkirjed on ERJK API-s täiseurodes; koondsendi võrdluses lubatakse kuni 0,50 € ümardust iga detailrea kohta. Isiku algidentifikaatorit ei kuvata.</p>
      </div>
      <p className="mt-2">Andmed: <a href={source.pageUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#245fae] underline underline-offset-2 dark:text-[#7db0ff]">ERJK avaandmed ↗</a> · <a href={source.apiDocumentationUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#245fae] underline underline-offset-2 dark:text-[#7db0ff]">API dokumentatsioon ↗</a> · <a href={source.licenceUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#245fae] underline underline-offset-2 dark:text-[#7db0ff]">{source.licence} ↗</a>. Andmete kõrvutamine reitingute või otsustega ei tõenda põhjuslikku seost.</p>
    </aside>
  );
}
