import { ArticleRow, type ArticleRowProps } from "@/features/news/client/article-row";
import type { NewsItem } from "@/lib/types";

type NewsListProps = Omit<ArticleRowProps, "item"> & {
  items: readonly NewsItem[];
};

export function NewsList({ items, ...articleRowProps }: NewsListProps) {
  return (
    <section aria-label="Uudiste nimekiri" aria-keyshortcuts="j k">
      <div className="hidden grid-cols-[9rem_8rem_minmax(0,1fr)_11rem] gap-x-5 border-y border-[#9fb2c0] bg-[#d5e0e7] px-2 py-1.5 text-[11px] font-semibold text-[#4b6170] dark:border-[#35536a] dark:bg-[#102538] dark:text-[#7890a2] md:grid">
        <span>Avaldatud / möödas</span>
        <span>Teema</span>
        <span>Uudis</span>
        <span>Allikas</span>
      </div>
      <ul>
        {items.map((item) => (
          <ArticleRow key={item.id} item={item} {...articleRowProps} />
        ))}
      </ul>
    </section>
  );
}
