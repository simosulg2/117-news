import { Suspense } from "react";
import { connection } from "next/server";
import NewsPortal from "@/components/news-portal";
import FeedSkeleton from "@/components/feed-skeleton";
import { getNews } from "@/lib/news";

export const revalidate = 300;

async function LiveNews() {
  await connection();
  const { items, failedFeeds } = await getNews();
  return <NewsPortal initialItems={items} failedFeeds={failedFeeds} />;
}

export default function Home() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <LiveNews />
    </Suspense>
  );
}
