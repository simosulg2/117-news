import { NowCard } from "./now-card";
import type { NowCard as NowCardType } from "../../../lib/now-types.ts";

type Props = {
  id: string;
  title: string;
  cards: readonly NowCardType[];
  newCardIds: ReadonlySet<string>;
  newWatchIds: ReadonlySet<string>;
  isRead: (card: NowCardType) => boolean;
  emptyText?: string;
  watched?: boolean;
};

export function NowCardSection({ id, title, cards, newCardIds, newWatchIds, isRead, emptyText, watched }: Props) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={`mb-2 text-sm font-bold ${watched ? "text-[#245fae] dark:text-[#7db0ff]" : "text-[#192630] dark:text-[#e5eef4]"}`}>{title}</h2>
      {cards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((card) => {
            const read = isRead(card);
            return <NowCard key={card.id} card={card} isRead={read} isNew={!read && newCardIds.has(card.id)} newWatchMatch={newWatchIds.has(card.id)} />;
          })}
        </div>
      ) : emptyText ? <p className="border border-[#9fb2c0] p-4 text-xs text-[#526878] dark:border-[#35536a] dark:text-[#8da1b0]">{emptyText}</p> : null}
    </section>
  );
}
