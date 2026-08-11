import { ArrowUpRight, ImageIcon } from "lucide-react";
import type { NewsItem } from "@/lib/news";

type Props = {
  item: NewsItem;
  featured?: boolean;
};

function formatTime(date: string) {
  const parsed = new Date(date);
  const now = new Date();
  const sameDay = parsed.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat("et-EE", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
  ).format(parsed);
}

export default function NewsCard({ item, featured = false }: Props) {
  const category = item.categories.find((value) => value !== "Viimased") || item.categories[0];

  return (
    <article className={featured ? "news-card news-card-featured" : "news-card"}>
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="card-image-wrap" aria-label={`Ava ERR-is: ${item.title}`}>
        {item.image ? (
          // RSS feeds can point to multiple ERR media hosts, so a native image keeps the source flexible.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="card-image" loading={featured ? "eager" : "lazy"} decoding="async" />
        ) : (
          <div className="card-image-fallback" aria-hidden="true">
            <span>117</span>
            <ImageIcon size={24} strokeWidth={1.4} />
          </div>
        )}
      </a>

      <div className="card-content">
        <div className="card-meta">
          <span className="category-label">{category}</span>
          <time dateTime={item.publishedAt}>{formatTime(item.publishedAt)}</time>
        </div>
        <h2>
          <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
        </h2>
        {item.summary && <p>{item.summary}</p>}
        <a className="read-link" href={item.link} target="_blank" rel="noopener noreferrer">
          Loe ERR-is <ArrowUpRight size={16} strokeWidth={1.8} />
        </a>
      </div>
    </article>
  );
}
