import { handleWeatherWarningsGet } from "@/features/weather/server/weather-warning.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handleWeatherWarningsGet();
}
