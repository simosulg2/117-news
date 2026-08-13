import { handleNowGet } from "@/features/now/server/now-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handleNowGet;
