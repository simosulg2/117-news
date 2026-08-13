import { buildFactionMatrix, voteDetailReconciles } from "../model/faction-matrix.ts";
import type { RiigikoguVoteDetail } from "@/lib/riigikogu-types";
import { record } from "./riigikogu-parser.ts";
import { parseVoters, parseVoteSummary } from "./vote-parser.ts";

export function parseVoteDetail(value: unknown, retrievedAt: string): RiigikoguVoteDetail {
  const raw = record(value, "vote detail");
  const summary = parseVoteSummary(raw);
  const voters = parseVoters(raw.voters);
  return {
    ...summary,
    voters,
    factions: buildFactionMatrix(voters),
    reconciles: voteDetailReconciles(voters, summary.totals),
    attribution: {
      name: "Riigikogu Kantselei avaandmed",
      sourceUrl: "https://www.riigikogu.ee/avaandmed/",
      licence: "CC BY-SA 3.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
      retrievedAt,
    },
  };
}
