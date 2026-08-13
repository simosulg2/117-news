import { handleRadarGet } from "@/features/weather/server/radar-manifest.server";

export const dynamic = "force-dynamic";
export const revalidate = 240;

export const GET = handleRadarGet;
