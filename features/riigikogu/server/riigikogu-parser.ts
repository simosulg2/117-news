// The official OpenAPI contract accepts UUID-shaped hexadecimal IDs without
// restricting RFC version/variant bits; several live faction IDs rely on that.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Riigikogu ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`Riigikogu ${label} must be a non-empty string`);
  }
  return value.trim();
}

export function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new TypeError(`Riigikogu ${label} must be a non-negative integer`);
  }
  return Number(value);
}

export function optionalInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

export function uuid(value: unknown, label: string): string {
  const id = string(value, label);
  if (!UUID_PATTERN.test(id)) throw new TypeError(`Riigikogu ${label} must be a UUID`);
  return id.toLowerCase();
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function classifierLabel(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return optionalString((value as Record<string, unknown>).value);
}

export function classifierCode(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return optionalString((value as Record<string, unknown>).code);
}

export function officialApiUrl(path: string): string {
  const url = new URL(path, "https://api.riigikogu.ee");
  if (url.protocol !== "https:" || url.hostname !== "api.riigikogu.ee") {
    throw new TypeError("Riigikogu source link used an unapproved host");
  }
  return url.toString();
}

export function sourceLink(value: unknown): string | null {
  try {
    const links = record(value, "links");
    const self = record(links.self, "self link");
    return officialApiUrl(string(self.href, "self link href"));
  } catch {
    return null;
  }
}

export function namedSourceLink(value: unknown, name: string): string | null {
  try {
    const links = record(value, "links");
    const link = record(links[name], `${name} link`);
    return officialApiUrl(string(link.href, `${name} link href`));
  } catch {
    return null;
  }
}

export function dateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(time) ? null : value;
}

function partsAtTallinn(timestamp: number): number[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return [get("year"), get("month"), get("day"), get("hour"), get("minute"), get("second")];
}

export function tallinnDateTime(value: unknown, label: string): string {
  const input = string(value, label);
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(input)) {
    const time = Date.parse(input);
    if (Number.isNaN(time)) throw new TypeError(`Riigikogu ${label} must be a date-time`);
    return new Date(time).toISOString();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(input);
  if (!match) throw new TypeError(`Riigikogu ${label} must be a date-time`);
  const expected = [
    Number(match[1]), Number(match[2]), Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6] ?? "0"),
  ];
  const milliseconds = Number((match[7] ?? "0").padEnd(3, "0"));
  const localAsUtc = Date.UTC(...([expected[0], expected[1] - 1, ...expected.slice(2)] as [number, number, number, number, number, number]));
  const observed = partsAtTallinn(localAsUtc);
  const offset = Date.UTC(...([observed[0], observed[1] - 1, ...observed.slice(2)] as [number, number, number, number, number, number])) - localAsUtc;
  const utc = localAsUtc - offset + milliseconds;
  const roundTrip = partsAtTallinn(utc);
  if (roundTrip.some((part, index) => part !== expected[index])) {
    throw new TypeError(`Riigikogu ${label} is not a valid Tallinn local time`);
  }
  return new Date(utc).toISOString();
}

export function cleanTitle(value: unknown, label: string): string {
  return string(value, label).replace(/\s+/g, " ");
}
