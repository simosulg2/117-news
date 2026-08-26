import type { PoolClient } from "pg";

import {
  MAX_STORY_MATCH_REPRESENTATIVES,
  NEWS_STORY_ACTIVE_WINDOW_MS,
  type StoryEvolutionArticle,
  type StoryEvolutionCandidate,
} from "@/features/news/model/story-evolution";
import type { FeedCategory, NewsSource } from "@/lib/types";

const MAX_ACTIVE_STORIES_PER_CATEGORY = 500;

type CandidateRow = {
  story_id: string;
  category: FeedCategory;
  last_activity_at: Date;
  event_id: string;
  anchor_article_id: string;
  anchor_title: string;
  anchor_summary: string;
  anchor_source: NewsSource;
  anchor_published_at: Date | null;
  seed_rank: string | number;
};

export type StoryEventAnchor = {
  eventId: string;
  article: StoryEvolutionArticle;
};

export type ActiveStoryState = {
  candidate: StoryEvolutionCandidate;
  events: StoryEventAnchor[];
};

function iso(value: Date | null): string | null {
  return value && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function rowArticle(row: CandidateRow): StoryEvolutionArticle {
  return {
    id: row.anchor_article_id,
    title: row.anchor_title,
    summary: row.anchor_summary,
    publishedAt: iso(row.anchor_published_at),
    category: row.category,
    source: row.anchor_source,
  };
}

export async function loadActiveStoryStates(
  client: PoolClient,
  now: Date,
): Promise<ActiveStoryState[]> {
  const cutoff = new Date(now.getTime() - NEWS_STORY_ACTIVE_WINDOW_MS);
  const result = await client.query<CandidateRow>(
    `
      WITH active_ranked AS (
        SELECT news_stories.*,
          ROW_NUMBER() OVER (
            PARTITION BY category ORDER BY last_activity_at DESC, id ASC
          ) AS category_rank
        FROM news_stories
        WHERE last_activity_at >= $1 AND last_activity_at <= $2
      ), active AS (
        SELECT * FROM active_ranked WHERE category_rank <= $3
      ), ranked AS (
        SELECT
          active.id AS story_id,
          active.category,
          active.last_activity_at,
          event.id AS event_id,
          event.anchor_article_id,
          event.anchor_title,
          event.anchor_summary,
          event.anchor_source,
          event.anchor_published_at,
          ROW_NUMBER() OVER (
            PARTITION BY active.id
            ORDER BY CASE WHEN anchor.match_kind = 'seed' THEN 0 ELSE 1 END,
              anchor.added_version ASC, event.created_at ASC, event.id ASC
          ) AS seed_rank,
          ROW_NUMBER() OVER (
            PARTITION BY active.id ORDER BY event.last_activity_at DESC, event.id ASC
          ) AS recent_rank
        FROM active
        JOIN news_story_events event ON event.story_id = active.id
        JOIN news_articles anchor
          ON anchor.id = event.anchor_article_id AND anchor.event_id = event.id
      )
      SELECT * FROM ranked
      WHERE seed_rank = 1 OR recent_rank <= $4
      ORDER BY story_id ASC, seed_rank ASC, event_id ASC
    `,
    [cutoff, now, MAX_ACTIVE_STORIES_PER_CATEGORY, MAX_STORY_MATCH_REPRESENTATIVES],
  );
  const states = new Map<string, ActiveStoryState>();
  for (const row of result.rows) {
    const article = rowArticle(row);
    const existing = states.get(row.story_id);
    if (!existing) {
      states.set(row.story_id, {
        candidate: {
          storyId: row.story_id,
          seed: article,
          representatives: [article],
          latestPublishedAt: row.last_activity_at.toISOString(),
        },
        events: [{ eventId: row.event_id, article }],
      });
      continue;
    }
    existing.events.push({ eventId: row.event_id, article });
    existing.candidate = {
      ...existing.candidate,
      seed: Number(row.seed_rank) === 1 ? article : existing.candidate.seed,
      representatives: [...existing.candidate.representatives, article],
    };
  }
  return [...states.values()];
}

export function advanceStoryState(
  state: ActiveStoryState,
  article: StoryEvolutionArticle,
  activityAt: Date,
  eventId?: string,
): void {
  const latest = Date.parse(state.candidate.latestPublishedAt ?? "");
  state.candidate = {
    ...state.candidate,
    latestPublishedAt: !Number.isFinite(latest) || activityAt.getTime() > latest
      ? activityAt.toISOString()
      : state.candidate.latestPublishedAt,
    representatives: eventId
      ? [...state.candidate.representatives, article]
      : state.candidate.representatives,
  };
  if (eventId) state.events.push({ eventId, article });
}
