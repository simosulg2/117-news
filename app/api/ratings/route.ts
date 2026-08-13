import { handleRatingsGet } from "@/features/ratings/server/ratings-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleRatingsGet;
