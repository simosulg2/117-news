import { handleEconomyGet } from "@/features/economy/server/economy-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleEconomyGet;
