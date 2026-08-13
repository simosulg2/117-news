const DATE_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})$/;
export const REQUIRED_SAMPLE_NAMES = [
  "total",
  "voters",
  "effectiveTotal",
  "effectiveVoters",
] as const;

export type SourceWave = readonly [id: string, startDate: string, endDate: string];
type SourceAxis = readonly [name: string, waves: readonly SourceWave[]];
export type SourceValue = number | null;
export type SourceBlock = readonly [
  axisId: number,
  partyIds: readonly number[],
  voterRows: readonly (readonly SourceValue[])[],
  nonVoterRow: readonly SourceValue[],
  sampleRows: readonly (readonly SourceValue[])[],
];

export type ValidNorstatPayload = {
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

export function invalidNorstatPayload(message: string): never {
  throw new NorstatRatingsParseError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalidNorstatPayload(`${field} must be an array`);
  return value;
}

function requireInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value)) invalidNorstatPayload(`${field} must be a safe integer`);
  return value as number;
}

function requireIndex(value: unknown, length: number, field: string): number {
  const index = requireInteger(value, field);
  if (index < 0 || index >= length) invalidNorstatPayload(`${field} is outside its target array`);
  return index;
}

function requireStrings(value: unknown, field: string): string[] {
  const array = requireArray(value, field);
  if (array.length === 0) invalidNorstatPayload(`${field} must not be empty`);
  const result = array.map((item, index) => {
    if (typeof item !== "string" || item.trim() === "") {
      invalidNorstatPayload(`${field}[${index}] must be a non-empty string`);
    }
    return item as string;
  });
  if (new Set(result).size !== result.length) {
    invalidNorstatPayload(`${field} must not contain duplicates`);
  }
  return result;
}

function sourceDate(value: unknown, field: string): string {
  if (typeof value !== "string") invalidNorstatPayload(`${field} must be a date string`);
  const match = DATE_PATTERN.exec(value as string);
  if (!match) invalidNorstatPayload(`${field} must use YYYY.MM.DD`);
  const [, year, month, day] = match;
  const normalized = `${year}-${month}-${day}`;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() + 1 !== Number(month)
    || date.getUTCDate() !== Number(day)
  ) {
    invalidNorstatPayload(`${field} is not a real calendar date`);
  }
  return normalized;
}

function validateAxis(value: unknown, field: string): SourceAxis {
  const axis = requireArray(value, field);
  if (axis.length !== 2 || typeof axis[0] !== "string" || axis[0].trim() === "") {
    invalidNorstatPayload(`${field} must be [name, waves]`);
  }
  const waves = requireArray(axis[1], `${field}[1]`);
  if (waves.length === 0) invalidNorstatPayload(`${field} must contain at least one wave`);
  let previousEndDate = "";
  const seenWaveIds = new Set<string>();
  const validatedWaves = waves.map((value, index): SourceWave => {
    const wave = requireArray(value, `${field}[1][${index}]`);
    if (wave.length !== 3 || typeof wave[0] !== "string" || wave[0].trim() === "") {
      invalidNorstatPayload(`${field}[1][${index}] must be [id, startDate, endDate]`);
    }
    if (seenWaveIds.has(wave[0] as string)) {
      invalidNorstatPayload(`${field} contains a duplicate wave ID`);
    }
    seenWaveIds.add(wave[0] as string);
    const startDate = sourceDate(wave[1], `${field}[1][${index}][1]`);
    const endDate = sourceDate(wave[2], `${field}[1][${index}][2]`);
    if (startDate > endDate) {
      invalidNorstatPayload(`${field}[1][${index}] starts after it ends`);
    }
    if (previousEndDate && endDate < previousEndDate) {
      invalidNorstatPayload(`${field} waves must be ordered by end date`);
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
  if (row.length !== length) invalidNorstatPayload(`${field} length does not match its axis`);
  return row.map((item, index) => {
    if (item === null) return null;
    const number = requireInteger(item, `${field}[${index}]`);
    if (number < 0 || number > maximum) {
      invalidNorstatPayload(`${field}[${index}] is outside its valid range`);
    }
    return number;
  });
}

export function validateNorstatPayload(input: unknown): ValidNorstatPayload {
  if (!isRecord(input)) invalidNorstatPayload("ratings payload must be an object");
  if (input.v !== 3) invalidNorstatPayload("unsupported Norstat ratings schema version");
  const q = requireInteger(input.q, "q");
  if (q <= 0 || q > 10_000) {
    invalidNorstatPayload("q must be a reasonable positive integer");
  }
  if (typeof input.n !== "string" || input.n.trim() === "") {
    invalidNorstatPayload("n must be a non-empty string");
  }
  const sampleNames = requireStrings(input.s, "s");
  for (const sampleName of REQUIRED_SAMPLE_NAMES) {
    if (!sampleNames.includes(sampleName)) invalidNorstatPayload(`s is missing ${sampleName}`);
  }
  const partyNames = requireStrings(input.p, "p");
  const axes = requireArray(input.a, "a");
  const nationalBlocks = requireArray(input.r, "r");
  const blocks = requireArray(input.b, "b");
  requireArray(input.g, "g");
  if (nationalBlocks.length < 2) {
    invalidNorstatPayload("r must identify weekly and four-week blocks");
  }
  const blockId = requireIndex(nationalBlocks[1], blocks.length, "r[1]");
  const rawBlock = requireArray(blocks[blockId], `b[${blockId}]`);
  if (rawBlock.length !== 5) invalidNorstatPayload(`b[${blockId}] must contain five fields`);
  const axisId = requireIndex(rawBlock[0], axes.length, `b[${blockId}][0]`);
  const axis = validateAxis(axes[axisId], `a[${axisId}]`);
  if (axis[0] !== "w4") invalidNorstatPayload("r[1] must point to the four-week axis");
  const waveCount = axis[1].length;
  const partyIds = requireArray(rawBlock[1], `b[${blockId}][1]`).map((partyId, index) =>
    requireIndex(partyId, partyNames.length, `b[${blockId}][1][${index}]`));
  if (partyIds.length === 0) invalidNorstatPayload("four-week block must contain parties");
  if (new Set(partyIds).size !== partyIds.length) {
    invalidNorstatPayload("four-week block has duplicate party IDs");
  }
  const rawVoterRows = requireArray(rawBlock[2], `b[${blockId}][2]`);
  if (rawVoterRows.length !== partyIds.length) {
    invalidNorstatPayload("four-week party IDs and voter rows must have equal lengths");
  }
  const maximumRating = 100 * q;
  const voterRows = rawVoterRows.map((row, index) =>
    validateValueRow(row, waveCount, maximumRating, `b[${blockId}][2][${index}]`));
  const nonVoterRow = validateValueRow(rawBlock[3], waveCount, maximumRating, `b[${blockId}][3]`);
  const rawSampleRows = requireArray(rawBlock[4], `b[${blockId}][4]`);
  if (rawSampleRows.length !== sampleNames.length) {
    invalidNorstatPayload("sample row count does not match s");
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
