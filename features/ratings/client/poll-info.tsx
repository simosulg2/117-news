import type { RatingsPoll } from "@/lib/ratings-types";

import { dateFormatter, numberFormatter, percentage } from "./ratings-formatters";

type PollInfoProps = {
  poll: RatingsPoll;
  thresholdWaste: number;
};

export function PollInfo({ poll, thresholdWaste }: PollInfoProps) {
  return (
    <section aria-labelledby="poll-heading" className="border border-[#9fb2c0] bg-[#f4f7f9] dark:border-[#35536a] dark:bg-[#0a1926]">
      <div className="border-b border-[#bdcad3] bg-[#dfe8ee] px-3 py-2 dark:border-[#294154] dark:bg-[#0d2030]">
        <h2 id="poll-heading" className="text-sm font-bold text-[#192630] dark:text-[#e5eef4]">Küsitluse info</h2>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-3 py-3 text-[11px] leading-5">
        <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Periood</dt>
        <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">{dateFormatter.format(new Date(`${poll.wave.startDate}T12:00:00Z`))}–{dateFormatter.format(new Date(`${poll.wave.endDate}T12:00:00Z`))}</dd>
        <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Valim</dt>
        <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">kokku n={poll.sample.total === null ? "—" : numberFormatter.format(poll.sample.total)}</dd>
        <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Reitingu alus</dt>
        <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">eelistusega n={poll.sample.voters === null ? "—" : numberFormatter.format(poll.sample.voters)}</dd>
        <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Eelistuseta</dt>
        <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">{percentage(poll.withoutPartyPreferencePct)}</dd>
        <dt className="font-semibold text-[#607583] dark:text-[#7890a2]">Alla künnise</dt>
        <dd className="text-right tabular-nums text-[#304654] dark:text-[#c2d0d9]">{percentage(thresholdWaste)}</dd>
      </dl>
    </section>
  );
}
