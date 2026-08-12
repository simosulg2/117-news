import type {
  RatingsParty,
  RatingsPartyKind,
  RatingsPoll,
  RatingsSample,
  RatingsSource,
  RatingsWave,
} from "./ratings-types.ts";

export const NORSTAT_RATINGS_DATA_URL =
  "https://kiir.kusitlus.com/_datasets_public/rk-ratings/ratings-compact.json";

export const NORSTAT_RATINGS_SOURCE: RatingsSource = {
  id: "norstat-yui",
  label: "Ühiskonnauuringute Instituut / Norstat",
  pollster: "Norstat Eesti AS",
  commissioner: "MTÜ Ühiskonnauuringute Instituut",
  dataUrl: NORSTAT_RATINGS_DATA_URL,
  documentationUrl: "https://rk.kusitlus.com/andmed",
  methodologyUrl: "https://reitingud.ee/",
  publisherUrl: "https://reitingud.ee/uudised/",
  license: null,
  schemaVersion: 3,
};

type PartyPresentation = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  kind?: RatingsPartyKind;
};

const PARTY_PRESENTATION: Readonly<Record<string, PartyPresentation>> = {
  "Sotsiaaldemokraatlik Erakond": {
    id: "sde",
    name: "Sotsiaaldemokraatlik Erakond",
    shortName: "SDE",
    color: "#E30613",
  },
  "Eesti Reformierakond": {
    id: "reform",
    name: "Eesti Reformierakond",
    shortName: "Reform",
    color: "#F2D321",
  },
  "Erakond Eestimaa Rohelised": {
    id: "rohelised",
    name: "Erakond Eestimaa Rohelised",
    shortName: "Rohelised",
    color: "#52A447",
  },
  "Eesti Vabaduspartei - Põllumeeste kogu": {
    id: "vabaduspartei-pollumeeste-kogu",
    name: "Eesti Vabaduspartei – Põllumeeste Kogu",
    shortName: "EVP-PK",
    color: "#64748B",
  },
  "Eestimaa Ühendatud Vasakpartei": {
    id: "vasakpartei",
    name: "Eestimaa Ühendatud Vasakpartei",
    shortName: "Vasakpartei",
    color: "#B91C1C",
  },
  "Eesti Konservatiivne Rahvaerakond": {
    id: "ekre",
    name: "Eesti Konservatiivne Rahvaerakond",
    shortName: "EKRE",
    color: "#1D4E89",
  },
  "Eesti Keskerakond": {
    id: "kesk",
    name: "Eesti Keskerakond",
    shortName: "Keskerakond",
    color: "#008A4B",
  },
  Isamaa: {
    id: "isamaa",
    name: "Isamaa",
    shortName: "Isamaa",
    color: "#009FE3",
  },
  "Muu erakond": {
    id: "other",
    name: "Muu erakond",
    shortName: "Muu",
    color: "#64748B",
    kind: "other",
  },
  "Elurikkuse erakond": {
    id: "elurikkus",
    name: "Elurikkuse Erakond",
    shortName: "Elurikkus",
    color: "#65A30D",
  },
  "Eesti 200": {
    id: "eesti200",
    name: "Eesti 200",
    shortName: "Eesti 200",
    color: "#00AEEF",
  },
  "Eesti Vabaerakond": {
    id: "vabaerakond",
    name: "Eesti Vabaerakond",
    shortName: "Vabaerakond",
    color: "#475569",
  },
  "Eesti Iseseisvuspartei": {
    id: "iseseisvuspartei",
    name: "Eesti Iseseisvuspartei",
    shortName: "EIP",
    color: "#334155",
  },
  "Erakond Parempoolsed": {
    id: "parempoolsed",
    name: "Erakond Parempoolsed",
    shortName: "Parempoolsed",
    color: "#7C3AED",
  },
  "Üksikkandidaadi poolt": {
    id: "independent",
    name: "Üksikkandidaat",
    shortName: "Üksikkandidaat",
    color: "#78716C",
    kind: "independent",
  },
  "Mihhail Stalnuhhin": {
    id: "mihhail-stalnuhhin",
    name: "Mihhail Stalnuhhin",
    shortName: "Stalnuhhin",
    color: "#78716C",
    kind: "independent",
  },
  "Eesti Rahvuslased ja Konservatiivid (ERK)": {
    id: "erk",
    name: "Eesti Rahvuslased ja Konservatiivid",
    shortName: "ERK",
    color: "#1E3A5F",
  },
  "Erakond KOOS": {
    id: "koos",
    name: "Erakond KOOS",
    shortName: "KOOS",
    color: "#7F1D1D",
  },
  "Vabaerakond Aru Pähe": {
    id: "aru-pahe",
    name: "Vabaerakond Aru Pähe",
    shortName: "Aru Pähe",
    color: "#57534E",
  },
  "Eesti Rahvusliberaalid - Vabaerakond": {
    id: "rahvusliberaalid-vabaerakond",
    name: "Eesti Rahvusliberaalid – Vabaerakond",
    shortName: "ERL-Vabaerakond",
    color: "#52525B",
  },
};

const FALLBACK_PARTY_COLOR = "#64748B";
const DATE_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})$/;
const REQUIRED_SAMPLE_NAMES = [
  "total",
  "voters",
  "effectiveTotal",
  "effectiveVoters",
] as const;

type SourceWave = readonly [id: string, startDate: string, endDate: string];
type SourceAxis = readonly [name: string, waves: readonly SourceWave[]];
type SourceValue = number | null;
type SourceBlock = readonly [
  axisId: number,
  partyIds: readonly number[],
  voterRows: readonly (readonly SourceValue[])[],
  nonVoterRow: readonly SourceValue[],
  sampleRows: readonly (readonly SourceValue[])[],
];

type ValidPayload = {
  q: number;
  sampleNames: readonly string[];
  partyNames: readonly string[];
  axis: SourceAxis;
  block: SourceBlock;
};

export class NorstatRatingsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NorstatRatingsParseError";
  }
}

function invalid(message: string): never {
  throw new NorstatRatingsParseError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  return value;
}

function requireInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value)) invalid(`${field} must be a safe integer`);
  return value as number;
}

function requireIndex(value: unknown, length: number, field: string): number {
  const index = requireInteger(value, field);
  if (index < 0 || index >= length) invalid(`${field} is outside its target array`);
  return index;
}

function requireStrings(value: unknown, field: string): string[] {
  const array = requireArray(value, field);
  if (array.length === 0) invalid(`${field} must not be empty`);

  const result = array.map((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      invalid(`${field}[${index}] must be a non-empty string`);
    }
    return item as string;
  });
  if (new Set(result).size !== result.length) invalid(`${field} must not contain duplicates`);
  return result;
}

function sourceDate(value: unknown, field: string): string {
  if (typeof value !== "string") invalid(`${field} must be a date string`);
  const match = DATE_PATTERN.exec(value as string);
  if (!match) invalid(`${field} must use YYYY.MM.DD`);

  const [, year, month, day] = match;
  const normalized = `${year}-${month}-${day}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() + 1 !== Number(month)
    || date.getUTCDate() !== Number(day)
  ) {
    invalid(`${field} is not a real calendar date`);
  }
  return normalized;
}

function validateAxis(value: unknown, field: string): SourceAxis {
  const axis = requireArray(value, field);
  if (axis.length !== 2 || typeof axis[0] !== "string" || axis[0].trim() === "") {
    invalid(`${field} must be [name, waves]`);
  }

  const waves = requireArray(axis[1], `${field}[1]`);
  if (waves.length === 0) invalid(`${field} must contain at least one wave`);
  let previousEndDate = "";
  const seenWaveIds = new Set<string>();

  const validatedWaves = waves.map((value, index): SourceWave => {
    const wave = requireArray(value, `${field}[1][${index}]`);
    if (wave.length !== 3 || typeof wave[0] !== "string" || wave[0].trim() === "") {
      invalid(`${field}[1][${index}] must be [id, startDate, endDate]`);
    }
    if (seenWaveIds.has(wave[0] as string)) invalid(`${field} contains a duplicate wave ID`);
    seenWaveIds.add(wave[0] as string);

    const startDate = sourceDate(wave[1], `${field}[1][${index}][1]`);
    const endDate = sourceDate(wave[2], `${field}[1][${index}][2]`);
    if (startDate > endDate) invalid(`${field}[1][${index}] starts after it ends`);
    if (previousEndDate && endDate < previousEndDate) {
      invalid(`${field} waves must be ordered by end date`);
    }
    previousEndDate = endDate;
    return [wave[0] as string, startDate, endDate];
  });

  return [axis[0] as string, validatedWaves];
}

function validateValueRow(
  value: unknown,
  length: number,
  maximum: number,
  field: string,
): SourceValue[] {
  const row = requireArray(value, field);
  if (row.length !== length) invalid(`${field} length does not match its axis`);
  return row.map((item, index) => {
    if (item === null) return null;
    const number = requireInteger(item, `${field}[${index}]`);
    if (number < 0 || number > maximum) invalid(`${field}[${index}] is outside its valid range`);
    return number;
  });
}

function validatePayload(input: unknown): ValidPayload {
  if (!isRecord(input)) invalid("ratings payload must be an object");
  if (input.v !== 3) invalid("unsupported Norstat ratings schema version");

  const q = requireInteger(input.q, "q");
  if (q <= 0 || q > 10_000) invalid("q must be a reasonable positive integer");

  if (typeof input.n !== "string" || input.n.trim() === "") {
    invalid("n must be a non-empty string");
  }
  const sampleNames = requireStrings(input.s, "s");
  for (const sampleName of REQUIRED_SAMPLE_NAMES) {
    if (!sampleNames.includes(sampleName)) invalid(`s is missing ${sampleName}`);
  }
  const partyNames = requireStrings(input.p, "p");
  const axes = requireArray(input.a, "a");
  const nationalBlocks = requireArray(input.r, "r");
  const blocks = requireArray(input.b, "b");
  requireArray(input.g, "g");
  if (nationalBlocks.length < 2) invalid("r must identify weekly and four-week blocks");

  const blockId = requireIndex(nationalBlocks[1], blocks.length, "r[1]");
  const rawBlock = requireArray(blocks[blockId], `b[${blockId}]`);
  if (rawBlock.length !== 5) invalid(`b[${blockId}] must contain five fields`);

  const axisId = requireIndex(rawBlock[0], axes.length, `b[${blockId}][0]`);
  const axis = validateAxis(axes[axisId], `a[${axisId}]`);
  if (axis[0] !== "w4") invalid("r[1] must point to the four-week axis");
  const waveCount = axis[1].length;

  const partyIds = requireArray(rawBlock[1], `b[${blockId}][1]`).map((partyId, index) =>
    requireIndex(partyId, partyNames.length, `b[${blockId}][1][${index}]`));
  if (partyIds.length === 0) invalid("four-week block must contain parties");
  if (new Set(partyIds).size !== partyIds.length) invalid("four-week block has duplicate party IDs");

  const rawVoterRows = requireArray(rawBlock[2], `b[${blockId}][2]`);
  if (rawVoterRows.length !== partyIds.length) {
    invalid("four-week party IDs and voter rows must have equal lengths");
  }
  const maximumRating = 100 * q;
  const voterRows = rawVoterRows.map((row, index) =>
    validateValueRow(row, waveCount, maximumRating, `b[${blockId}][2][${index}]`));
  const nonVoterRow = validateValueRow(
    rawBlock[3],
    waveCount,
    maximumRating,
    `b[${blockId}][3]`,
  );

  const rawSampleRows = requireArray(rawBlock[4], `b[${blockId}][4]`);
  if (rawSampleRows.length !== sampleNames.length) {
    invalid("sample row count does not match s");
  }
  const sampleRows = rawSampleRows.map((row, index) =>
    validateValueRow(row, waveCount, Number.MAX_SAFE_INTEGER, `b[${blockId}][4][${index}]`));

  return {
    q,
    sampleNames,
    partyNames,
    axis,
    block: [axisId, partyIds, voterRows, nonVoterRow, sampleRows],
  };
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("et-EE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function partyPresentation(sourceName: string, sourceIndex: number): PartyPresentation {
  const known = PARTY_PRESENTATION[sourceName];
  if (known) return known;
  const sourceSlug = slug(sourceName) || `party-${sourceIndex}`;
  return {
    id: `source-${sourceSlug}`,
    name: sourceName,
    shortName: sourceName,
    color: FALLBACK_PARTY_COLOR,
  };
}

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

/**
 * Decodes the latest nationwide rolling four-week result (`r[1]`) in the
 * documented compact schema v3. It intentionally does not project seats.
 */
export function parseNorstatRatings(input: unknown): RatingsPoll {
  const payload = validatePayload(input);
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
      invalid(`multiple source parties normalize to the ID ${party.id}`);
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
