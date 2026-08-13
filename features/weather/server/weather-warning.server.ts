import { readBoundedResponseText } from "../../../lib/bounded-response.ts";
import { InProcessSnapshotCache } from "../../../lib/snapshot-cache.ts";
import type { WeatherWarning, WeatherWarningLevel, WeatherWarningsResponse } from "../../../lib/weather-warning-types.ts";
import { visibleWeatherWarnings } from "../../../lib/weather-warnings.ts";

export const WEATHER_WARNING_URL = "https://www.ilmateenistus.ee/ilma_andmed/xml/hoiatus.php";
const DOCUMENTATION_URL = "https://keskkonnaportaal.ee/et/avaandmed/ilmaprognoosid";
const MAX_XML_BYTES = 300_000;
const warningCache = new InProcessSnapshotCache<WeatherWarningsResponse>(10 * 60_000, 2 * 60_000);

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ").trim();
}

function tagValue(xml: string, names: readonly string[]): string | null {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (match) {
      const value = decodeXml(match[1]);
      if (value) return value.slice(0, 2_000);
    }
  }
  return null;
}

function attributeValue(attributes: string, names: readonly string[]): string | null {
  for (const name of names) {
    const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"));
    if (match) return decodeXml(match[1]).slice(0, 500) || null;
  }
  return null;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function directRecordText(body: string): string | null {
  const withoutCdata = body.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "");
  if (/<[a-z][^>]*>/i.test(withoutCdata)) return null;
  const value = decodeXml(body);
  return value ? value.slice(0, 2_000) : null;
}

type TargetWarningArea = { canonical: string; level: "national" | "county" | "municipality" };

const TARGET_WARNING_AREAS = new Map<string, TargetWarningArea>([
  ["eesti", { canonical: "Eesti", level: "national" }],
  ["eesti vabariik", { canonical: "Eesti", level: "national" }],
  ["voru maakond", { canonical: "Võru maakond", level: "county" }],
  ["voru linn", { canonical: "Võru linn", level: "municipality" }],
  ["voru vald", { canonical: "Võru vald", level: "municipality" }],
  ["antsla", { canonical: "Antsla vald", level: "municipality" }],
  ["antsla vald", { canonical: "Antsla vald", level: "municipality" }],
  ["rouge", { canonical: "Rõuge vald", level: "municipality" }],
  ["rouge vald", { canonical: "Rõuge vald", level: "municipality" }],
  ["setomaa", { canonical: "Setomaa vald", level: "municipality" }],
  ["setomaa vald", { canonical: "Setomaa vald", level: "municipality" }],
]);

function normalizedAreaName(value: string): string {
  return value.toLocaleLowerCase("et-EE").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function targetWarningArea(value: string): TargetWarningArea | null {
  return TARGET_WARNING_AREAS.get(normalizedAreaName(value)) ?? null;
}

function recordToWarning(attributes: string, body: string): { recognized: boolean; warning: WeatherWarning | null } {
  const explicitArea = tagValue(body, ["county", "area", "region", "location", "maakond", "municipality", "vald", "linn"])
    ?? attributeValue(attributes, ["county", "area", "region", "location", "municipality"])
    ?? tagValue(body, ["name"]);
  const levelValue = tagValue(body, ["level", "severity", "risklevel", "tase"])
    ?? attributeValue(attributes, ["level", "severity", "risklevel"]);
  const levelNumber = Number(levelValue?.match(/[1-3]/)?.[0]);
  const level = [1, 2, 3].includes(levelNumber) ? levelNumber as WeatherWarningLevel : null;
  const phenomenonValue = tagValue(body, ["phenomenon", "event", "type", "warningtype", "nahtus", "nähtus"])
    ?? attributeValue(attributes, ["phenomenon", "event", "type"]);
  const descriptionValue = tagValue(body, ["description", "text", "content", "headline", "message", "sisu"]);
  const directText = directRecordText(body);
  const narrative = descriptionValue ?? phenomenonValue ?? directText;

  const areaMatch = explicitArea ? targetWarningArea(explicitArea) : null;
  if (explicitArea && !areaMatch) {
    return { recognized: true, warning: null };
  }
  if (levelValue !== null && level === null) return { recognized: false, warning: null };
  const isNational = explicitArea ? areaMatch?.level === "national" : levelValue === null && narrative !== null;
  if (!explicitArea && !isNational) return { recognized: false, warning: null };
  if (level === null && (!isNational || narrative === null)) return { recognized: false, warning: null };

  const area = isNational ? "Eesti" : areaMatch!.canonical;
  const phenomenon = phenomenonValue ?? (level === null ? "Üleriigiline hoiatus" : "Ilmahoiatus");
  const description = descriptionValue ?? directText ?? phenomenonValue ?? phenomenon;
  const validFrom = isoDate(tagValue(body, ["start", "onset", "validfrom", "valid_from", "from"])
    ?? attributeValue(attributes, ["start", "onset", "validfrom", "valid_from", "from"]));
  const validTo = isoDate(tagValue(body, ["end", "expires", "validto", "valid_to", "to"])
    ?? attributeValue(attributes, ["end", "expires", "validto", "valid_to", "to"]));
  const stable = `${area}|${phenomenon}|${validFrom ?? ""}|${validTo ?? ""}`;
  return { recognized: true, warning: {
    id: `weather-warning:${fingerprint(stable)}`,
    revisionId: fingerprint(`${stable}|${level ?? "ungraded"}|${description}`),
    area,
    level,
    phenomenon,
    description,
    validFrom,
    validTo,
  } };
}

export function parseWeatherWarningsXml(xml: string): WeatherWarning[] {
  const clean = xml.trim();
  if (!/^<\?xml\b/i.test(clean) && !/^<warnings\b/i.test(clean)) throw new Error("Warning source is not XML");
  if (/<warnings\s*\/>/i.test(clean) || /<warnings\b[^>]*>\s*<\/warnings>/i.test(clean)) return [];
  const warnings: WeatherWarning[] = [];
  let records = 0;
  let recognizedRecords = 0;
  const recordPattern = /<(warning|hoiatus)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const match of clean.matchAll(recordPattern)) {
    records += 1;
    const parsed = recordToWarning(match[2], match[3]);
    if (parsed.recognized) recognizedRecords += 1;
    const warning = parsed.warning;
    if (warning && !warnings.some((item) => item.id === warning.id && item.revisionId === warning.revisionId)) warnings.push(warning);
  }
  if (records === 0 && /<(warning|hoiatus)\b/i.test(clean)) throw new Error("Warning XML records were not recognized");
  if (records > 0 && recognizedRecords === 0) throw new Error("Warning XML schema was not recognized");
  if (!/<warnings\b/i.test(clean)) throw new Error("Unknown warning XML root");
  return warnings.sort((left, right) => (right.level ?? 0) - (left.level ?? 0)
    || (Date.parse(left.validFrom ?? "") || 0) - (Date.parse(right.validFrom ?? "") || 0));
}

function normalizedHttpDate(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

async function refreshWeatherWarnings(): Promise<WeatherWarningsResponse> {
  const response = await fetch(WEATHER_WARNING_URL, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    headers: { Accept: "application/xml,text/xml", "User-Agent": "117.ee weather warnings (+https://117.ee)" },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Warning source returned HTTP ${response.status}`);
  }
  const type = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (type && !type.includes("xml") && !type.startsWith("text/plain")) {
    await response.body?.cancel();
    throw new Error("Warning source returned unexpected content type");
  }
  const fetchedAtMs = Date.now();
  return {
    area: "Võru maakond",
    warnings: visibleWeatherWarnings(parseWeatherWarningsXml(await readBoundedResponseText(response, MAX_XML_BYTES)), fetchedAtMs),
    fetchedAt: new Date(fetchedAtMs).toISOString(),
    sourceUpdatedAt: normalizedHttpDate(response.headers.get("last-modified")),
    source: { name: "Keskkonnaagentuur / Ilmateenistus", url: WEATHER_WARNING_URL, documentationUrl: DOCUMENTATION_URL, license: "CC BY 4.0" },
  };
}

export async function getWeatherWarningsSnapshot() {
  return warningCache.get(refreshWeatherWarnings);
}

export async function handleWeatherWarningsGet(): Promise<Response> {
  try {
    const snapshot = await getWeatherWarningsSnapshot();
    const cacheControl = snapshot.status === "stale-if-error"
      ? "no-store"
      : "public, max-age=0, s-maxage=120, stale-while-revalidate=600";
    const responseValue = {
      ...snapshot.value,
      warnings: visibleWeatherWarnings(snapshot.value.warnings, Date.now()),
    };
    return Response.json(responseValue, { headers: { "Cache-Control": cacheControl, "X-Weather-Warnings-Snapshot": snapshot.status } });
  } catch (error) {
    console.error("Weather warning refresh failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ error: "Ilmahoiatuste laadimine ebaõnnestus." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
