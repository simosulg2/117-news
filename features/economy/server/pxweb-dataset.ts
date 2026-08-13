type JsonObject = Record<string, unknown>;

export type PxCell = {
  value: number | null;
  status: string | null;
};

type ParsedDimension = {
  codes: string[];
  labels: Record<string, string>;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${name} must be a string array`);
  }
  return value;
}

function numberArray(value: unknown, name: string): number[] {
  if (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item) || item <= 0)) {
    throw new TypeError(`${name} must be an array of positive integers`);
  }
  return value as number[];
}

function categoryCodes(index: unknown, expectedSize: number, dimension: string): string[] {
  let codes: string[];
  if (Array.isArray(index)) {
    codes = stringArray(index, `${dimension}.category.index`);
  } else if (isObject(index)) {
    const ordered = Object.entries(index).map(([code, position]) => {
      if (!Number.isSafeInteger(position) || (position as number) < 0) {
        throw new TypeError(`${dimension} contains an invalid category position`);
      }
      return [code, position as number] as const;
    });
    ordered.sort((left, right) => left[1] - right[1]);
    if (ordered.some((entry, position) => entry[1] !== position)) {
      throw new TypeError(`${dimension} category positions must be contiguous`);
    }
    codes = ordered.map(([code]) => code);
  } else {
    throw new TypeError(`${dimension}.category.index is missing`);
  }
  if (codes.length !== expectedSize || new Set(codes).size !== codes.length) {
    throw new TypeError(`${dimension} category count does not match its declared size`);
  }
  return codes;
}

function categoryLabels(value: unknown, codes: string[], dimension: string): Record<string, string> {
  if (!isObject(value)) throw new TypeError(`${dimension}.category.label is missing`);
  const labels: Record<string, string> = {};
  for (const code of codes) {
    const label = value[code];
    if (typeof label !== "string" || !label.trim()) {
      throw new TypeError(`${dimension} has no label for ${code}`);
    }
    labels[code] = label;
  }
  return labels;
}

function sparseValues(value: unknown, cellCount: number): Array<number | null> {
  const result: Array<number | null> = Array(cellCount).fill(null);
  const entries = Array.isArray(value) ? value.entries() : isObject(value) ? Object.entries(value) : null;
  if (!entries) throw new TypeError("dataset.value must be an array or sparse object");
  for (const [rawIndex, rawValue] of entries) {
    const index = Number(rawIndex);
    if (!Number.isSafeInteger(index) || index < 0 || index >= cellCount) {
      throw new RangeError("dataset.value contains an out-of-range cell");
    }
    if (rawValue !== null && (typeof rawValue !== "number" || !Number.isFinite(rawValue))) {
      throw new TypeError("dataset.value contains a non-numeric value");
    }
    result[index] = rawValue as number | null;
  }
  return result;
}

function sparseStatuses(value: unknown, cellCount: number): Array<string | null> {
  const result: Array<string | null> = Array(cellCount).fill(null);
  if (value === undefined) return result;
  const entries = Array.isArray(value) ? value.entries() : isObject(value) ? Object.entries(value) : null;
  if (!entries) throw new TypeError("dataset.status must be an array or sparse object");
  for (const [rawIndex, rawValue] of entries) {
    const index = Number(rawIndex);
    if (!Number.isSafeInteger(index) || index < 0 || index >= cellCount) {
      throw new RangeError("dataset.status contains an out-of-range cell");
    }
    if (rawValue !== null && typeof rawValue !== "string") {
      throw new TypeError("dataset.status contains an invalid value");
    }
    result[index] = rawValue as string | null;
  }
  return result;
}

export class ParsedPxDataset {
  readonly dimensions: string[];
  readonly label: string;
  readonly source: string | null;
  readonly tableId: string | null;
  readonly updatedAt: string | null;
  private readonly cells: Array<number | null>;
  private readonly statuses: Array<string | null>;
  private readonly dimensionData: Record<string, ParsedDimension>;
  private readonly sizes: number[];

  constructor(input: unknown) {
    if (!isObject(input) || input.class !== "dataset") throw new TypeError("Expected a JSON-stat2 dataset");
    this.dimensions = stringArray(input.id, "dataset.id");
    this.sizes = numberArray(input.size, "dataset.size");
    if (this.dimensions.length !== this.sizes.length || new Set(this.dimensions).size !== this.dimensions.length) {
      throw new TypeError("Dataset dimensions and sizes do not align");
    }
    const cellCount = this.sizes.reduce((total, size) => total * size, 1);
    if (!Number.isSafeInteger(cellCount) || cellCount > 10_000) throw new RangeError("Dataset cell count is unsafe");
    if (!isObject(input.dimension)) throw new TypeError("dataset.dimension is missing");
    const dimensionsObject = input.dimension;
    this.dimensionData = {};
    this.dimensions.forEach((dimension, index) => {
      const rawDimension = dimensionsObject[dimension];
      if (!isObject(rawDimension) || !isObject(rawDimension.category)) {
        throw new TypeError(`Dataset dimension ${dimension} is invalid`);
      }
      const codes = categoryCodes(rawDimension.category.index, this.sizes[index], dimension);
      const labels = categoryLabels(rawDimension.category.label, codes, dimension);
      this.dimensionData[dimension] = { codes, labels };
    });
    this.cells = sparseValues(input.value, cellCount);
    this.statuses = sparseStatuses(input.status, cellCount);
    this.label = typeof input.label === "string" ? input.label : "";
    this.source = typeof input.source === "string" ? input.source : null;
    this.updatedAt = normalizedUpdatedAt(input.updated);
    const extension = isObject(input.extension) ? input.extension : null;
    const px = extension && isObject(extension.px) ? extension.px : null;
    this.tableId = px && typeof px.tableid === "string" ? px.tableid : null;
  }

  codes(dimension: string): string[] {
    const data = this.dimensionData[dimension];
    if (!data) throw new RangeError(`Unknown dimension ${dimension}`);
    return [...data.codes];
  }

  categoryLabel(dimension: string, code: string): string {
    const label = this.dimensionData[dimension]?.labels[code];
    if (!label) throw new RangeError(`Unknown category ${dimension}:${code}`);
    return label;
  }

  cell(coordinates: Record<string, string>): PxCell {
    let offset = 0;
    for (let index = 0; index < this.dimensions.length; index += 1) {
      const dimension = this.dimensions[index];
      const code = coordinates[dimension];
      const position = this.dimensionData[dimension].codes.indexOf(code);
      if (position < 0) throw new RangeError(`Unknown coordinate ${dimension}:${code ?? "missing"}`);
      offset = offset * this.sizes[index] + position;
    }
    return { value: this.cells[offset], status: this.statuses[offset] };
  }
}

function normalizedUpdatedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).getUTCFullYear() >= 9999) return null;
  return new Date(time).toISOString();
}

export function assertPxSchema(
  dataset: ParsedPxDataset,
  expectedDimensions: readonly string[],
  expectedLabels: Record<string, Record<string, string>>,
): void {
  if (
    dataset.dimensions.length !== expectedDimensions.length
    || expectedDimensions.some((dimension) => !dataset.dimensions.includes(dimension))
  ) {
    throw new TypeError("Statistics Estonia table dimensions changed");
  }
  for (const [dimension, categories] of Object.entries(expectedLabels)) {
    for (const [code, expectedLabel] of Object.entries(categories)) {
      if (dataset.categoryLabel(dimension, code) !== expectedLabel) {
        throw new TypeError(`Statistics Estonia category changed: ${dimension}:${code}`);
      }
    }
  }
}
