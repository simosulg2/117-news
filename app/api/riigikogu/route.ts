import { handleRiigikoguOverviewGet } from "@/features/riigikogu/server/riigikogu-route.server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  return handleRiigikoguOverviewGet();
}
