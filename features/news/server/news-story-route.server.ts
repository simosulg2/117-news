import {
  newsStoryDatabaseConfigured,
  safeNewsStoryDatabaseErrorDetails,
} from "@/features/news/server/news-story-database.server";
import {
  isNewsStoryId,
  loadNewsStoryDetail,
} from "@/features/news/server/news-story-read.server";

const NO_STORE = { "Cache-Control": "no-store" };

export async function handleNewsStoryGet(id: string): Promise<Response> {
  if (!isNewsStoryId(id)) {
    return Response.json({ error: "Kajastust ei leitud." }, { status: 404, headers: NO_STORE });
  }
  if (!newsStoryDatabaseConfigured()) {
    return Response.json(
      { error: "Kajastuse ajalugu pole selles keskkonnas saadaval." },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const story = await loadNewsStoryDetail(id);
    return story
      ? Response.json(story, { headers: NO_STORE })
      : Response.json({ error: "Kajastust ei leitud." }, { status: 404, headers: NO_STORE });
  } catch (error) {
    console.error("News story detail read failed", safeNewsStoryDatabaseErrorDetails(error));
    return Response.json(
      { error: "Kajastuse ajaloo laadimine ebaõnnestus." },
      { status: 503, headers: NO_STORE },
    );
  }
}
