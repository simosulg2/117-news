import { handleWeatherHistoryGet } from "@/features/weather/server/weather-history-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

export const GET = handleWeatherHistoryGet;
