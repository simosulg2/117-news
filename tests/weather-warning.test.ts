import assert from "node:assert/strict";
import test from "node:test";

import { WEATHER_WARNING_URL, parseWeatherWarningsXml } from "../features/weather/server/weather-warning.server.ts";
import { visibleWeatherWarnings, weatherWarningPhase } from "../lib/weather-warnings.ts";

test("empty official warning document means no active warnings", () => {
  assert.deepEqual(parseWeatherWarningsXml('<?xml version="1.0"?><warnings/>'), []);
});

test("warning fetch uses the canonical no-redirect official host", () => {
  assert.equal(new URL(WEATHER_WARNING_URL).hostname, "www.ilmateenistus.ee");
});

test("parser keeps Võru and national warnings with distinct levels and times", () => {
  const warnings = parseWeatherWarningsXml(`<?xml version="1.0"?><warnings>
    <warning><area>Võru maakond</area><level>2</level><phenomenon>Äike</phenomenon><description>Tugev äike.</description><start>2026-08-13T09:00:00+03:00</start><end>2026-08-13T18:00:00+03:00</end></warning>
    <warning level="1" area="Eesti"><event>Kuumus</event><text>Kuum ilm.</text></warning>
    <warning><area>Harju maakond</area><level>3</level><event>Tuul</event></warning>
  </warnings>`);
  assert.equal(warnings.length, 2);
  assert.equal(warnings[0].level, 2);
  assert.equal(warnings[0].validFrom, "2026-08-13T06:00:00.000Z");
  assert.equal(warnings[1].area, "Eesti");
});

test("revisions preserve a stable event ID while changing the fingerprint", () => {
  const first = parseWeatherWarningsXml('<warnings><warning area="Võru maakond" level="1"><event>Tuul</event><text>15 m/s</text></warning></warnings>')[0];
  const revised = parseWeatherWarningsXml('<warnings><warning area="Võru maakond" level="2"><event>Tuul</event><text>20 m/s</text></warning></warnings>')[0];
  assert.equal(first.id, revised.id);
  assert.notEqual(first.revisionId, revised.revisionId);
});

test("parser follows the explicit Võru County municipality allowlist", () => {
  const warnings = parseWeatherWarningsXml(`<warnings>
    <warning area="Võru linn" level="1"><event>Tuul</event></warning>
    <warning area="Võru vald" level="1"><event>Tuul</event></warning>
    <warning><municipality>Antsla</municipality><level>1</level><event>Tuul</event></warning>
    <warning area="Rõuge vald" level="1"><event>Tuul</event></warning>
    <warning area="Setomaa" level="1"><event>Tuul</event></warning>
    <warning area="Otepää vald" level="3"><event>Tuul</event></warning>
    <warning area="Põlva maakond" level="3"><event>Tuul</event></warning>
  </warnings>`);
  assert.deepEqual(new Set(warnings.map((warning) => warning.area)), new Set([
    "Võru linn", "Võru vald", "Antsla vald", "Rõuge vald", "Setomaa vald",
  ]));
  assert.equal(warnings.length, 5);
});

test("validity helpers separate active and upcoming notices and remove expired ones", () => {
  const warnings = parseWeatherWarningsXml(`<warnings>
    <warning area="Võru linn" level="3"><event>Aegunud</event><start>2026-08-13T08:00:00Z</start><end>2026-08-13T09:00:00Z</end></warning>
    <warning area="Antsla" level="1"><event>Aktiivne</event><start>2026-08-13T09:00:00Z</start><end>2026-08-13T11:00:00Z</end></warning>
    <warning area="Rõuge" level="2"><event>Tulevane</event><start>2026-08-13T12:00:00Z</start><end>2026-08-13T14:00:00Z</end></warning>
  </warnings>`);
  const nowMs = Date.parse("2026-08-13T10:00:00Z");
  assert.deepEqual(visibleWeatherWarnings(warnings, nowMs).map((warning) => warning.phenomenon), ["Aktiivne", "Tulevane"]);
  assert.equal(weatherWarningPhase(warnings.find((warning) => warning.phenomenon === "Aegunud")!, nowMs), "expired");
  assert.equal(weatherWarningPhase(warnings.find((warning) => warning.phenomenon === "Aktiivne")!, nowMs), "active");
  assert.equal(weatherWarningPhase(warnings.find((warning) => warning.phenomenon === "Tulevane")!, nowMs), "upcoming");
});

test("parser keeps an official nationwide text-only notice without inventing a level", () => {
  const [warning] = parseWeatherWarningsXml(`<?xml version="1.0"?><warnings>
    <warning><text>Kogu Eestis on suure metsapõlenguohu tõttu erakorraline teade.</text></warning>
  </warnings>`);
  assert.equal(warning.area, "Eesti");
  assert.equal(warning.level, null);
  assert.equal(warning.phenomenon, "Üleriigiline hoiatus");
  assert.match(warning.description, /metsapõlenguohu/);
});

test("parser accepts a plain-text nationwide notice but rejects unknown structured records", () => {
  const [warning] = parseWeatherWarningsXml("<warnings><warning><![CDATA[Üleriigiline oluline ilmateade.]]></warning></warnings>");
  assert.equal(warning.level, null);
  assert.equal(warning.area, "Eesti");
  assert.throws(() => parseWeatherWarningsXml("<warnings><warning><unknown>x</unknown></warning></warnings>"), /schema/);
});

test("unknown non-XML input fails closed", () => {
  assert.throws(() => parseWeatherWarningsXml("not xml"), /not XML/);
  assert.throws(() => parseWeatherWarningsXml("<warnings><warning><unknown>x</unknown></warning></warnings>"), /schema/);
});
