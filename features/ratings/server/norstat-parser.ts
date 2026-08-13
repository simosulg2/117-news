import type {
  RatingsParty,
  RatingsPoll,
  RatingsSample,
  RatingsWave,
} from "../../../lib/ratings-types.ts";
import { NORSTAT_RATINGS_SOURCE, partyPresentation } from "./norstat-source.ts";
import {
  invalidNorstatPayload,
  NorstatRatingsParseError,
  REQUIRED_SAMPLE_NAMES,
  type SourceBlock,
  type SourceValue,
  type SourceWave,
  validateNorstatPayload,
} from "./norstat-schema.ts";

export { NorstatRatingsParseError };

function percentage(value: SourceValue, q: number): number | null {
  return value === null ? null : value / q;
}

function change(current: SourceValue, previous: SourceValue, q: number): number | null {
  if (current === null || previous === null) return null;
  return (current - previous) / q;
}

function ratingsWave(source: SourceWave): RatingsWave {
  return {
    id: source[0],
    kind: "rolling-four-week",
    startDate: source[1],
    endDate: source[2],
  };
}

function sampleAt(
  sampleNames: readonly string[],
  sampleRows: SourceBlock[4],
  name: (typeof REQUIRED_SAMPLE_NAMES)[number],
  waveIndex: number,
): number | null {
  const rowIndex = sampleNames.indexOf(name);
  return sampleRows[rowIndex][waveIndex];
}

/** Decodes the latest nationwide rolling four-week result (`r[1]`) in schema v3. */
export function parseNorstatRatings(input: unknown): RatingsPoll {
  const payload = validateNorstatPayload(input);
  const [, partyIds, voterRows, nonVoterRow, sampleRows] = payload.block;
  const waves = payload.axis[1];
  const latestIndex = waves.length - 1;
  const previousIndex = latestIndex > 0 ? latestIndex - 1 : null;
  const parties: RatingsParty[] = partyIds.map((partyId, rowIndex) => {
    const sourceName = payload.partyNames[partyId];
    const presentation = partyPresentation(sourceName, partyId);
    const currentValue = voterRows[rowIndex][latestIndex];
    const previousValue = previousIndex === null ? null : voterRows[rowIndex][previousIndex];
    return {
      id: presentation.id,
      name: presentation.name,
      shortName: presentation.shortName,
      sourceName,
      color: presentation.color,
      kind: presentation.kind ?? "party",
      supportPct: percentage(currentValue, payload.q),
      previousSupportPct: percentage(previousValue, payload.q),
      changePctPoints: previousIndex === null
        ? null
        : change(currentValue, previousValue, payload.q),
    };
  });

  const normalizedPartyIds = new Set<string>();
  for (const party of parties) {
    if (normalizedPartyIds.has(party.id)) {
      invalidNorstatPayload(`multiple source parties normalize to the ID ${party.id}`);
    }
    normalizedPartyIds.add(party.id);
  }
  parties.sort((left, right) => {
    if (left.supportPct === null) return right.supportPct === null ? 0 : 1;
    if (right.supportPct === null) return -1;
    return right.supportPct - left.supportPct;
  });

  const sample: RatingsSample = {
    total: sampleAt(payload.sampleNames, sampleRows, "total", latestIndex),
    voters: sampleAt(payload.sampleNames, sampleRows, "voters", latestIndex),
    effectiveTotal: sampleAt(payload.sampleNames, sampleRows, "effectiveTotal", latestIndex),
    effectiveVoters: sampleAt(payload.sampleNames, sampleRows, "effectiveVoters", latestIndex),
  };
  return {
    source: NORSTAT_RATINGS_SOURCE,
    wave: ratingsWave(waves[latestIndex]),
    previousWave: previousIndex === null ? null : ratingsWave(waves[previousIndex]),
    sample,
    withoutPartyPreferencePct: percentage(nonVoterRow[latestIndex], payload.q),
    basis: "party-preference respondents",
    population: "Estonian citizens aged 18+",
    parties,
  };
}
