import { handlePoliticalFinanceRecordsGet } from "@/features/political-finance/server/political-finance-route.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handlePoliticalFinanceRecordsGet;
