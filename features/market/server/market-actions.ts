"use server";

import { requireScheduleUser } from "../../auth/server/require-schedule-user";
import type { MarketRefreshResult } from "../../../lib/market-types";

import { loadMarketSnapshot } from "./market-source.server";

export async function refreshMarketAction(): Promise<MarketRefreshResult> {
  await requireScheduleUser("/turg");
  try {
    return { ok: true, snapshot: await loadMarketSnapshot() };
  } catch {
    return {
      ok: false,
      error: "Turuhindade laadimine ebaõnnestus. Proovi hetke pärast uuesti.",
    };
  }
}
