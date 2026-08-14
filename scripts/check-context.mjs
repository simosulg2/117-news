import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ["app", "components", "features", "lib"];
const tailwindUiRoots = ["app", "components", "features"];
const sourceExtensions = new Set([".ts", ".tsx"]);

const DEFAULT_LIMIT = 300;
const PORTAL_LIMIT = 200;
const ROUTE_LIMIT = 100;
const VISUAL_LIMIT = 400;
const DEFAULT_CHARACTER_LIMIT = 12_000;
const PORTAL_CHARACTER_LIMIT = 8_000;
const ROUTE_CHARACTER_LIMIT = 4_000;
const VISUAL_CHARACTER_LIMIT = 20_000;

// Temporary ceilings make existing debt visible without blocking incremental
// splits. They are not target sizes: remove an entry once the file meets its
// normal limit. No new exception should be added without an explanation here.
const legacyCeilings = new Map();

const visualModules = new Set([
  "components/riigikogu-seat-map.tsx",
  "features/weather/client/metric-chart.tsx",
]);

if (legacyCeilings.size > 0) {
  console.log("Context check includes temporary legacy ceilings; remove them after each split.");
}

function portablePath(path) {
  return path.split(sep).join("/");
}

function normalLimit(path) {
  if (path.startsWith("app/api/") && path.endsWith("/route.ts")) return ROUTE_LIMIT;
  if (/^components\/[^/]+-portal\.tsx$/.test(path)) return PORTAL_LIMIT;
  if (visualModules.has(path)) return VISUAL_LIMIT;
  return DEFAULT_LIMIT;
}

function normalCharacterLimit(path) {
  if (path.startsWith("app/api/") && path.endsWith("/route.ts")) {
    return ROUTE_CHARACTER_LIMIT;
  }
  if (/^components\/[^/]+-portal\.tsx$/.test(path)) return PORTAL_CHARACTER_LIMIT;
  if (visualModules.has(path)) return VISUAL_CHARACTER_LIMIT;
  return DEFAULT_CHARACTER_LIMIT;
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

function lineCount(contents) {
  if (contents.length === 0) return 0;
  const lines = contents.split(/\r?\n/).length;
  return /\r?\n$/.test(contents) ? lines - 1 : lines;
}

function importSpecifiers(contents) {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) specifiers.add(match[1]);
  }
  return specifiers;
}

function importsServerModule(specifier) {
  const segments = specifier.replaceAll("\\", "/").split("/");
  const fileName = segments.at(-1) ?? "";
  return segments.includes("server")
    || fileName.endsWith(".server")
    || /\.server\.[cm]?[jt]sx?$/.test(fileName);
}

const files = (await Promise.all(
  sourceRoots.map((root) => sourceFiles(join(repositoryRoot, root))),
)).flat();

const failures = [];
const configurationFailures = [];
const activeLegacy = [];

const tailwindConfig = await readFile(join(repositoryRoot, "tailwind.config.ts"), "utf8");
for (const root of tailwindUiRoots) {
  const requiredPrefix = `./${root}/**/*`;
  if (!tailwindConfig.includes(requiredPrefix)) {
    configurationFailures.push(
      `tailwind.config.ts must scan ${requiredPrefix} so production CSS keeps ${root} classes`,
    );
  }
}

for (const file of files) {
  const path = portablePath(relative(repositoryRoot, file));
  const contents = await readFile(file, "utf8");
  const isolatedLayer = path.includes("/model/")
    ? "model"
    : path.includes("/client/") ? "client" : null;
  if (isolatedLayer) {
    for (const specifier of importSpecifiers(contents)) {
      if (importsServerModule(specifier)) {
        configurationFailures.push(
          `${path}: ${isolatedLayer} modules must not import server module ${specifier}`,
        );
      }
    }
  }
  const lines = lineCount(contents);
  const characters = contents.length;
  const target = normalLimit(path);
  const characterLimit = normalCharacterLimit(path);
  const legacy = legacyCeilings.get(path);
  const ceiling = legacy?.limit ?? target;

  if (lines > ceiling || characters > characterLimit) {
    failures.push({
      path,
      lines,
      ceiling,
      target,
      characters,
      characterLimit,
      legacy,
    });
  } else if (legacy && lines > target) {
    activeLegacy.push({ path, lines, ceiling, target, reason: legacy.reason });
  }
}

if (activeLegacy.length > 0) {
  console.log(`Context check: ${activeLegacy.length} legacy exception(s) remain:`);
  for (const item of activeLegacy.sort((left, right) => left.path.localeCompare(right.path))) {
    console.log(
      `  ${item.path}: ${item.lines}/${item.ceiling} lines (target ${item.target}; ${item.reason})`,
    );
  }
}

if (configurationFailures.length > 0) {
  console.error(`Context check failed for ${configurationFailures.length} configuration issue(s):`);
  for (const message of configurationFailures) console.error(`  ${message}`);
}

if (failures.length > 0) {
  console.error(`Context check failed for ${failures.length} file(s):`);
  for (const item of failures.sort((left, right) => left.path.localeCompare(right.path))) {
    console.error(
      `  ${item.path}: ${item.lines}/${item.ceiling} lines; `
        + `${item.characters}/${item.characterLimit} characters` +
        (item.legacy ? ` (target ${item.target}; ${item.legacy.reason})` : ""),
    );
  }
}

if (configurationFailures.length > 0 || failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`Context check passed: ${files.length} source modules inspected.`);
}
