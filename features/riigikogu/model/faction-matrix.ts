import type {
  RiigikoguFactionVote,
  RiigikoguVoteChoice,
  RiigikoguVoter,
} from "@/lib/riigikogu-types";

const CHOICES: RiigikoguVoteChoice[] = [
  "in-favor",
  "against",
  "neutral",
  "did-not-vote",
  "absent",
  "unknown",
];

const CAST_CHOICES = ["in-favor", "against", "neutral"] as const;

function emptyTotals(): Record<RiigikoguVoteChoice, number> {
  return Object.fromEntries(CHOICES.map((choice) => [choice, 0])) as Record<RiigikoguVoteChoice, number>;
}

export function factionPlurality(
  totals: Record<RiigikoguVoteChoice, number>,
): RiigikoguFactionVote["plurality"] {
  const maximum = Math.max(...CAST_CHOICES.map((choice) => totals[choice]));
  if (maximum === 0) return null;
  const leaders = CAST_CHOICES.filter((choice) => totals[choice] === maximum);
  return leaders.length === 1 ? leaders[0] : null;
}

export function buildFactionMatrix(voters: readonly RiigikoguVoter[]): RiigikoguFactionVote[] {
  const groups = new Map<string, { name: string; voters: RiigikoguVoter[] }>();
  for (const voter of voters) {
    const id = voter.factionId ?? "unaffiliated";
    const group = groups.get(id) ?? { name: voter.factionName ?? "Fraktsioonita / teadmata", voters: [] };
    group.voters.push(voter);
    groups.set(id, group);
  }
  return [...groups.entries()].map(([factionId, group]) => {
    const totals = emptyTotals();
    for (const voter of group.voters) totals[voter.choice] += 1;
    const plurality = factionPlurality(totals);
    return {
      factionId,
      factionName: group.name,
      totals,
      plurality,
      deviations: plurality
        ? group.voters.filter((voter) => CAST_CHOICES.includes(voter.choice as typeof CAST_CHOICES[number]) && voter.choice !== plurality)
          .map((voter) => voter.fullName).sort((left, right) => left.localeCompare(right, "et"))
        : [],
    };
  }).sort((left, right) => {
    const leftSize = Object.values(left.totals).reduce((sum, count) => sum + count, 0);
    const rightSize = Object.values(right.totals).reduce((sum, count) => sum + count, 0);
    return rightSize - leftSize || left.factionName.localeCompare(right.factionName, "et");
  });
}

export function voteDetailReconciles(
  voters: readonly RiigikoguVoter[],
  official: {
    present: number;
    absent: number;
    inFavor: number;
    against: number;
    neutral: number;
    notVotingOrAbsent: number;
  },
): boolean {
  const totals = emptyTotals();
  for (const voter of voters) totals[voter.choice] += 1;
  return totals.unknown === 0
    && totals["in-favor"] === official.inFavor
    && totals.against === official.against
    && totals.neutral === official.neutral
    && totals.absent === official.absent
    && voters.length - totals.absent === official.present
    && totals["did-not-vote"] + totals.absent === official.notVotingOrAbsent;
}
