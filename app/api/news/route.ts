import {
  NEWS_FEEDS,
} from "@/features/news/server/feed-config";
import { getNewsSnapshot } from "@/features/news/server/news-service.server";
import {
  NewsSnapshotRefreshError,
  type NewsUnavailableBody,
} from "@/features/news/server/news-snapshot.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const snapshot = await getNewsSnapshot();

    return Response.json(snapshot.value, {
      headers: {
        "Cache-Control": "no-store",
        "X-News-Snapshot": snapshot.status,
      },
    });
  } catch (error) {
    if (!(error instanceof NewsSnapshotRefreshError)) {
      console.error("Failed to refresh news snapshot", error);
    }

    const responseBody: NewsUnavailableBody = error instanceof NewsSnapshotRefreshError
      ? error.responseBody
      : {
          error: "Uudiste laadimine ebaõnnestus. Palun proovi mõne hetke pärast uuesti.",
          sources: {
            loaded: 0,
            total: NEWS_FEEDS.length,
            failed: [],
            failures: [],
          },
        };

    return Response.json(responseBody, {
      status: 502,
      headers: {
        "Cache-Control": "no-store",
        "X-News-Snapshot": "unavailable",
      },
    });
  }
}
