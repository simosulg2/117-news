import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import {
  newStoryAssociation,
  NEWS_STORY_RETENTION_MS,
  selectStoryEvolutionMatch,
} from "@/features/news/model/story-evolution";
import type { NewsArticle, NewsStoryMatchKind, NewsStoryMatchReason } from "@/lib/types";
import {
  advanceStoryState,
  loadActiveStoryStates,
  type ActiveStoryState,
  type StoryEventAnchor,
} from "./news-story-candidates.server.ts";
import {
  persistableNewsArticle,
  strictCoverageScore,
  type PersistableNewsArticle,
} from "./news-story-ingestion-model.server.ts";
import {
  advanceNewsStory,
  createNewsStory,
  insertStoryArticle,
  insertStoryEvent,
  reconcileSingletonNewsStory,
  updateKnownArticle,
} from "./news-story-write.server.ts";

const NEWS_STORY_ADVISORY_LOCK = 117_117_001;
const MAX_RETENTION_DELETES = 1_000;

export type NewsStoryIngestResult = {
  storedArticles: number;
  affectedStories: number;
};

function chooseCoverage(
  article: NewsArticle,
  states: readonly ActiveStoryState[],
  now: Date,
): { state: ActiveStoryState; event: StoryEventAnchor; score: number } | null {
  const matches = states.flatMap((state) => state.events.flatMap((event) => {
    const score = strictCoverageScore(article, event.article, now);
    return score === null ? [] : [{ state, event, score }];
  }));
  return matches.sort((left, right) =>
    right.score - left.score
    || left.state.candidate.storyId.localeCompare(right.state.candidate.storyId)
    || left.event.eventId.localeCompare(right.event.eventId))[0] ?? null;
}

export async function ingestNewsStoryBatch(
  client: PoolClient,
  articles: readonly NewsArticle[],
  collectedAt: Date,
): Promise<NewsStoryIngestResult> {
  await client.query("SELECT pg_advisory_xact_lock($1)", [NEWS_STORY_ADVISORY_LOCK]);
  const states = await loadActiveStoryStates(client, collectedAt);
  const affectedStories = new Set<string>();
  const retentionCutoff = collectedAt.getTime() - NEWS_STORY_RETENTION_MS;
  const values = articles.map((article) => persistableNewsArticle(article, collectedAt))
    .filter((value): value is PersistableNewsArticle =>
      value !== null && value.activityAt.getTime() >= retentionCutoff)
    .sort((left, right) =>
      left.activityAt.getTime() - right.activityAt.getTime()
      || left.article.id.localeCompare(right.article.id));
  let storedArticles = 0;

  for (const value of values) {
    const known = await updateKnownArticle(client, value, collectedAt, affectedStories);
    if (known.status === "collision") continue;
    const candidateStates = known.status === "handled"
      ? states.filter(({ candidate }) => candidate.storyId !== known.storyId)
      : states;
    const coverage = chooseCoverage(value.article, candidateStates, collectedAt);
    const evolution = coverage ? null : selectStoryEvolutionMatch(
      value.article,
      candidateStates.map(({ candidate }) => candidate),
      collectedAt,
    );
    let state = coverage?.state
      ?? (evolution ? states.find(({ candidate }) => candidate.storyId === evolution.storyId) : undefined);

    if (known.status === "handled") {
      storedArticles += 1;
      if (!state) continue;
      const kind = coverage ? "coverage" : "evolution";
      const reconciled = await reconcileSingletonNewsStory(client, value, {
        sourceStoryId: known.storyId,
        targetStoryId: state.candidate.storyId,
        targetEventId: coverage?.event.eventId ?? null,
        kind,
        score: coverage?.score ?? evolution!.score,
        reasons: coverage
          ? ["strict_title", "time_proximity"]
          : evolution!.reasons,
        matchedArticleId: coverage?.event.article.id ?? evolution!.matchedArticleId,
      }, collectedAt);
      if (!reconciled) continue;
      const sourceIndex = states.findIndex(({ candidate }) => candidate.storyId === known.storyId);
      if (sourceIndex >= 0) states.splice(sourceIndex, 1);
      advanceStoryState(
        state,
        value.article,
        value.activityAt,
        kind === "evolution" ? reconciled.eventId : undefined,
      );
      affectedStories.delete(known.storyId);
      affectedStories.add(state.candidate.storyId);
      continue;
    }

    let storyId: string;
    let eventId: string;
    let version: number;
    let kind: NewsStoryMatchKind;
    let score: number;
    let reasons: NewsStoryMatchReason[];
    let matchedArticleId: string | null;

    if (!state) {
      const created = await createNewsStory(client, value, collectedAt);
      ({ storyId, eventId, version } = created);
      kind = "seed";
      ({ score, reasons } = newStoryAssociation());
      matchedArticleId = null;
      state = {
        candidate: {
          storyId,
          seed: value.article,
          representatives: [value.article],
          latestPublishedAt: value.activityAt.toISOString(),
        },
        events: [{ eventId, article: value.article }],
      };
      states.push(state);
    } else if (coverage) {
      storyId = state.candidate.storyId;
      eventId = coverage.event.eventId;
      version = await advanceNewsStory(client, storyId, value, false, collectedAt);
      await client.query(
        `UPDATE news_story_events SET first_activity_at = LEAST(first_activity_at, $2),
          last_activity_at = GREATEST(last_activity_at, $2) WHERE id = $1`,
        [eventId, value.activityAt],
      );
      kind = "coverage";
      score = coverage.score;
      reasons = ["strict_title", "time_proximity"];
      matchedArticleId = coverage.event.article.id;
      advanceStoryState(state, value.article, value.activityAt);
    } else {
      storyId = state.candidate.storyId;
      eventId = randomUUID();
      version = await advanceNewsStory(client, storyId, value, true, collectedAt);
      await insertStoryEvent(client, storyId, eventId, value);
      kind = "evolution";
      score = evolution!.score;
      reasons = evolution!.reasons;
      matchedArticleId = evolution!.matchedArticleId;
      advanceStoryState(state, value.article, value.activityAt, eventId);
    }

    await insertStoryArticle(client, value, {
      storyId, eventId, version, kind, score, reasons, matchedArticleId,
    }, collectedAt);
    affectedStories.add(storyId);
    storedArticles += 1;
  }

  await client.query(
    `WITH expired AS (
      SELECT id FROM news_stories WHERE last_activity_at < $1
      ORDER BY last_activity_at ASC, id ASC LIMIT $2
    ) DELETE FROM news_stories WHERE id IN (SELECT id FROM expired)`,
    [new Date(retentionCutoff), MAX_RETENTION_DELETES],
  );
  return { storedArticles, affectedStories: affectedStories.size };
}
