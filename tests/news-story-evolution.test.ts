import assert from "node:assert/strict";
import test from "node:test";

import {
  createEvolutionFingerprint,
  evolutionNumberRelationship,
  newStoryAssociation,
  NEWS_STORY_ACTIVE_WINDOW_MS,
  NEWS_STORY_RETENTION_MS,
  scoreStoryEvolutionCandidate,
  scoreStoryEvolutionPair,
  selectStoryEvolutionMatch,
  type StoryEvolutionArticle,
  type StoryEvolutionCandidate,
} from "../features/news/model/story-evolution.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1_000;

function article(
  id: string,
  title: string,
  options: Partial<StoryEvolutionArticle> & { hoursAgo?: number } = {},
): StoryEvolutionArticle {
  const { hoursAgo = 1, ...overrides } = options;
  return {
    id,
    title,
    summary: "",
    source: "ERR",
    category: "Eesti",
    publishedAt: new Date(NOW.getTime() - hoursAgo * HOUR_MS).toISOString(),
    ...overrides,
  };
}

function story(
  storyId: string,
  seed: StoryEvolutionArticle,
  representatives: readonly StoryEvolutionArticle[] = [],
): StoryEvolutionCandidate {
  const latest = [seed, ...representatives]
    .map((item) => item.publishedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  return { storyId, seed, representatives, latestPublishedAt: latest };
}

test("exports the agreed matching and retention windows", () => {
  assert.equal(NEWS_STORY_ACTIVE_WINDOW_MS, 72 * HOUR_MS);
  assert.equal(NEWS_STORY_RETENTION_MS, 30 * 24 * HOUR_MS);
});

test("creates accent-folded, inflection-aware Estonian anchors", () => {
  const first = createEvolutionFingerprint(article("first", "OTSE: Tallinnas jätkub sadamapõleng"));
  const second = createEvolutionFingerprint(article("second", "Tallinna sadamapõlengu uurimine jätkub"));

  assert.ok(first.names.has("tallin"));
  assert.ok(second.names.has("tallin"));
  assert.ok(first.titleAnchors.has("sadama"));
  assert.ok(second.titleAnchors.has("sadama"));
  assert.ok(!first.titleAnchors.has("otse"));
});

test("matches a strong same-source follow-up at the stricter threshold", () => {
  const summary = "Kallas lahkub ministriametist ja astub pärast eelarvevaidlust tagasi.";
  const result = scoreStoryEvolutionPair(
    article("first", "Kallas astus ministriametist tagasi", { hoursAgo: 2, summary }),
    article("follow-up", "Kallas selgitas ministriametist tagasi astumist", { summary }),
    NOW,
  );

  assert.equal(result.matches, true);
  assert.equal(result.threshold, 0.63);
  assert.ok(result.reasons.includes("shared_name"));
  assert.ok(result.reasons.includes("summary_similarity"));
});

test("uses a strong RSS-summary overlap when headlines evolve", () => {
  const result = scoreStoryEvolutionPair(
    article("statement", "Kallas tegi avalduse", {
      hoursAgo: 2,
      summary: "Kallas lahkub ministriametist ja astub tagasi pärast eelarvevaidlust.",
    }),
    article("decision", "Minister selgitas oma otsust", {
      source: "Postimees",
      summary: "Kallas astub ministriametist tagasi pärast eelarvevaidlust.",
    }),
    NOW,
  );

  assert.equal(result.matches, true);
  assert.ok(result.reasons.includes("summary_similarity"));
  assert.ok(!result.reasons.includes("strict_title"));
});

test("recognizes same-source article and clip variants with shared title anchors", () => {
  const result = scoreStoryEvolutionPair(
    article("article", "Tartu linn ja paadiomanikud otsivad uusi lahendusi sadamakohtade loomiseks", {
      summary: "Tartus on Emajõel väikelaevu rohkem kui sildumiskohti ning sadamakohad on täitunud.",
      hoursAgo: 2,
    }),
    article("clip", "Paadiomanikud: Tartu vajab uusi sadamakohti", {
      summary: "Tartus on Emajõel paatidele üle 400 sadama- ja peatumiskoha.",
    }),
    NOW,
  );

  assert.equal(result.matches, true);
  assert.ok(result.reasons.includes("strong_context"));
});

test("recognizes cross-source match reports despite a combined headline", () => {
  const result = scoreStoryEvolutionPair(
    article("postimees", "Premium liiga viimane kukutas Kalju karikasarjast", {
      source: "Postimees",
      summary: "Narva Trans alistas täna õhtul Eesti jalgpalli karikavõistluste kaheksandikfinaalis Nõmme Kalju 2:0 ja edenes veerandfinaali ning Premium liigas suutis kaotusseisust välja tulnud Tammeka võita Florat 3:1.",
      hoursAgo: 2,
    }),
    article("err", "Trans lülitas karikasarjas Kalju konkurentsist, Levadia alistas Paide", {
      summary: "Evald Tipneri nime kandvatel Eesti jalgpalli karikavõistlustel alistas Narva Trans kolmapäeval 2:0 Nõmme Kalju ja pääses veerandfinaali. FCI Levadia oli Paide Linnameeskonnast üle 4:1 ja tagas koha kaheksandikfinaalis.",
    }),
    NOW,
  );

  assert.equal(result.matches, true);
  assert.ok(result.reasons.includes("strong_context"));
});

test("uses names carried between a headline and summary for report rewrites", () => {
  const result = scoreStoryEvolutionPair(
    article("later", "Tartu kooli seina varisemine toob linnale kaasa miljoneid eurosid lisakulu", {
      summary: "Tartu Miina Härma gümnaasiumi remont kujuneb varisenud seina tõttu kallimaks ja teiste koolide remonti see ei mõjuta.",
      hoursAgo: 4,
    }),
    article("earlier", "Miina Härma gümnaasiumi remondi kulud ei mõjuta teiste koolide renoveerimist", {
      summary: "Tartu Miina Härma gümnaasiumi remont kujuneb juurdeehituse seina varisemise tõttu kallimaks.",
    }),
    NOW,
  );

  assert.equal(result.matches, true);
  assert.ok(result.reasons.includes("strong_context"));
});

test("does not merge different interviews that share event boilerplate", () => {
  const result = scoreStoryEvolutionPair(
    article("doctor", "Korvpallikoondise arst: maskiga lihtne ei ole, aga Drell on professionaal", {
      summary: "Koondise arst rääkis Ungari mängu eel vigastatud mängijatest ja Henri Drellist.",
      hoursAgo: 2,
    }),
    article("player", "Nõmm: tahame hea ettevalmistuse võitudeks realiseerida", {
      summary: "Korvpallikoondis valmistub Ungari mänguks ning Märt Rosenthal ja Matthias Tass treenisid koos koondisega.",
    }),
    NOW,
  );

  assert.equal(result.matches, false);
});

test("keeps similar openings with different event nouns separate", () => {
  const result = scoreStoryEvolutionPair(
    article("school", "Tallinn avab uue kooli Lasnamäel"),
    article("kindergarten", "Tallinn avab uue lasteaia Lasnamäel", { source: "Postimees" }),
    NOW,
  );

  assert.equal(result.matches, false);
  assert.deepEqual(result.reasons, []);
});

test("does not treat a shared place and generic reporting language as an event", () => {
  const result = scoreStoryEvolutionPair(
    article("decision", "Tallinn teatas täna uuest haridusotsusest"),
    article("plan", "Tallinn teatas täna uuest liiklusplaanist", { source: "Postimees" }),
    NOW,
  );

  assert.equal(result.matches, false);
});

test("permits changed counts only as negative, auditable evidence", () => {
  const left = article("initial", "Tallinna sadama põlengus sai vigastada 12 inimest", { hoursAgo: 2 });
  const updated = article("updated", "Tallinna sadama põlengus sai vigastada 13 inimest", {
    source: "Postimees",
  });
  const unchanged = article("unchanged", "Tallinna sadama põlengus sai vigastada 12 inimest", {
    source: "Postimees",
  });
  const changedResult = scoreStoryEvolutionPair(left, updated, NOW);
  const unchangedResult = scoreStoryEvolutionPair(left, unchanged, NOW);

  assert.equal(evolutionNumberRelationship(
    createEvolutionFingerprint(left).numbers,
    createEvolutionFingerprint(updated).numbers,
  ), "changed");
  assert.equal(changedResult.matches, true);
  assert.ok(changedResult.reasons.includes("numbers_changed"));
  assert.ok(changedResult.score < unchangedResult.score);
});

test("rejects weak generic headlines even when only their numbers change", () => {
  const result = scoreStoryEvolutionPair(
    article("twelve", "Täna tuleb 12 uut uudist"),
    article("thirteen", "Täna tuleb 13 uut uudist", { source: "Postimees" }),
    NOW,
  );

  assert.equal(result.matches, false);
});

test("requires the same category", () => {
  const first = article("economy", "Nordtek sulgeb Tartu tehase", { category: "Majandus" });
  const second = article("sport", "Nordtek sulgeb Tartu tehase", {
    category: "Sport",
    source: "Postimees",
  });
  assert.equal(scoreStoryEvolutionPair(first, second, NOW).matches, false);
});

test("uses an inclusive 72-hour activity boundary", () => {
  const current = article("current", "Nordtek sulgeb Tartu tehase", { hoursAgo: 0 });
  const boundary = article("boundary", "Nordtek sulgeb Tartu tehase", {
    hoursAgo: 72,
    source: "Postimees",
  });
  const outside = article("outside", "Nordtek sulgeb Tartu tehase", {
    hoursAgo: 72 + 1 / 3_600_000,
    source: "Postimees",
  });

  assert.equal(scoreStoryEvolutionPair(current, boundary, NOW).matches, true);
  assert.equal(scoreStoryEvolutionPair(current, outside, NOW).matches, false);
});

test("rejects undated, invalid, and future-dated candidates", () => {
  const representative = article("known", "Nordtek sulgeb Tartu tehase", { source: "Postimees" });
  for (const publishedAt of [null, "not-a-date", new Date(NOW.getTime() + 1).toISOString()]) {
    const candidate = article(`candidate-${publishedAt}`, "Nordtek sulgeb Tartu tehase", { publishedAt });
    assert.equal(scoreStoryEvolutionPair(candidate, representative, NOW).matches, false);
  }
});

test("requires seed or repeated core evidence and blocks transitive topic drift", () => {
  const seed = article("seed", "Kallas: maksureform muudab ettevõtete maksustamist", { hoursAgo: 3 });
  const bridge = article(
    "bridge",
    "Kallas: maksureformi järel muutub ka linnatransport",
    { hoursAgo: 2, source: "Postimees" },
  );
  const drifting = article("drift", "Kallas: linnatranspordi piletihinnad tõusevad", {
    summary: "Linnatranspordi piletihinnad tõusevad järgmisel kuul.",
  });

  assert.equal(scoreStoryEvolutionCandidate(drifting, story("story", seed, [bridge]), NOW), null);
});

test("selects deterministically by score and then lexical story ID", () => {
  const seed = article("seed", "Nordtek sulgeb Tartu tehase", { hoursAgo: 2, source: "Postimees" });
  const candidate = article("candidate", "Nordtek sulgeb Tartu tehase töötajate sõnul");
  const result = selectStoryEvolutionMatch(
    candidate,
    [story("story-b", seed), story("story-a", seed)],
    NOW,
  );

  assert.equal(result?.storyId, "story-a");
  assert.equal(result?.matchedArticleId, "seed");
});

test("returns the fixed seed association without mutable shared state", () => {
  const first = newStoryAssociation();
  first.reasons.push("new_story");
  assert.deepEqual(newStoryAssociation(), { score: 1, reasons: ["new_story"] });
});
