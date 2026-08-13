import {
  handleWeatherGet,
  handleWeatherPost,
} from "@/features/weather/server/weather-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300;

export const GET = handleWeatherGet;
export const POST = handleWeatherPost;
