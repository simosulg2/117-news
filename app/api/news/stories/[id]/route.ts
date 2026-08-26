import { handleNewsStoryGet } from "@/features/news/server/news-story-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return handleNewsStoryGet(id);
}
