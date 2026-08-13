import { handleRiigikoguVoteGet } from "@/features/riigikogu/server/riigikogu-route.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return handleRiigikoguVoteGet(id);
}
