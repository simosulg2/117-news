import { NEWS_STORY_ACTIVE_WINDOW_MS } from "@/features/news/model/story-evolution";
import type {
  FeedCategory,
  NewsArticle,
  NewsSource,
  NewsStoryArticle,
  NewsStoryDetailResponse,
  NewsStoryMatchKind,
  NewsStoryMatchReason,
  NewsStoryPreview,
} from "@/lib/types";
import type { NewsStoryAssociation } from "@/lib/news-collections";
import { newsStoryPool } from "./news-story-database.server.ts";

const MAX_STORED_OVERVIEW_STORIES_PER_CATEGORY = 117;
const MAX_DETAIL_EVENTS = 40;
const MAX_DETAIL_ARTICLES = 117;
const STORY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

type PreviewRow = {
  story_id: string;
  article_count: number | string;
  event_count: number | string;
  first_published_at: Date | null;
  latest_published_at: Date | null;
  latest_article_id: string;
  version: number | string;
  updated_at: Date;
};

type AssociationRow = PreviewRow & { article_id: string; event_id: string };

type StoredOverviewRow = AssociationRow & {
  title: string;
  link: string;
  summary: string;
  published_at: Date | null;
  category: FeedCategory;
  source: NewsSource;
};

type EventRow = { id: string; published_at: Date | null; first_activity_at: Date };

type DetailArticleRow = {
  id: string;
  event_id: string;
  title: string;
  link: string;
  summary: string;
  published_at: Date | null;
  category: FeedCategory;
  source: NewsSource;
  first_seen_at: Date;
  added_version: number | string;
  match_kind: string;
  match_score: number | string;
  match_reasons: unknown;
  revision_count: number | string;
};

export type StoredNewsOverview = {
  articles: NewsArticle[];
  associations: Map<string, NewsStoryAssociation>;
  updatedAt: string;
};

function iso(value: Date | null): string | null {
  return value && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function count(value: number | string): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function preview(row: PreviewRow): NewsStoryPreview {
  return {
    id: row.story_id,
    articleCount: count(row.article_count),
    eventCount: count(row.event_count),
    firstPublishedAt: iso(row.first_published_at),
    latestPublishedAt: iso(row.latest_published_at),
    latestArticleId: row.latest_article_id,
    version: count(row.version),
  };
}

export function isNewsStoryId(value: string): boolean {
  return STORY_ID_PATTERN.test(value);
}

export async function loadNewsStoryAssociations(
  articleIds: readonly string[],
): Promise<Map<string, NewsStoryAssociation>> {
  if (articleIds.length === 0) return new Map();
  const pool = newsStoryPool();
  if (!pool) return new Map();
  const ids = [...new Set(articleIds.filter((id) => id.length > 0 && id.length <= 128))].slice(0, 600);
  const result = await pool.query<AssociationRow>(
    `SELECT article.id AS article_id, article.event_id::text, story.id::text AS story_id,
      story.article_count, story.event_count, story.first_published_at,
      story.latest_published_at, story.latest_article_id, story.version, story.updated_at
     FROM news_articles article
     JOIN news_stories story ON story.id = article.story_id
     WHERE article.id = ANY($1::text[])`,
    [ids],
  );
  return new Map(result.rows.map((row) => [
    row.article_id,
    { coverageId: row.event_id, story: preview(row) },
  ]));
}

export async function loadStoredNewsOverview(now: Date): Promise<StoredNewsOverview | null> {
  const pool = newsStoryPool();
  if (!pool) return null;
  const cutoff = new Date(now.getTime() - NEWS_STORY_ACTIVE_WINDOW_MS);
  const result = await pool.query<StoredOverviewRow>(
    `WITH active_ranked AS (
      SELECT news_stories.*,
        ROW_NUMBER() OVER (
          PARTITION BY category ORDER BY last_activity_at DESC, id ASC
        ) AS category_rank
      FROM news_stories
      WHERE last_activity_at >= $1 AND last_activity_at <= $2
    ), active AS (
      SELECT * FROM active_ranked WHERE category_rank <= $3
    ), latest AS (
      SELECT DISTINCT ON (article.story_id) article.*
      FROM news_articles article JOIN active ON active.id = article.story_id
      ORDER BY article.story_id, article.activity_at DESC, article.id ASC
    )
    SELECT latest.id AS article_id, latest.event_id::text, latest.title, latest.link,
      latest.summary, latest.published_at, latest.category, latest.source,
      active.id::text AS story_id, active.article_count, active.event_count,
      active.first_published_at, active.latest_published_at, active.latest_article_id,
      active.version, active.updated_at
    FROM active JOIN latest ON latest.story_id = active.id
    ORDER BY active.last_activity_at DESC, active.id ASC`,
    [cutoff, now, MAX_STORED_OVERVIEW_STORIES_PER_CATEGORY],
  );
  if (result.rows.length === 0) return null;
  const associations = new Map<string, NewsStoryAssociation>();
  const articles = result.rows.map((row) => {
    associations.set(row.article_id, { coverageId: row.event_id, story: preview(row) });
    return {
      id: row.article_id,
      title: row.title,
      link: row.link,
      summary: row.summary,
      publishedAt: iso(row.published_at),
      category: row.category,
      source: row.source,
    };
  });
  const newestUpdate = Math.max(...result.rows.map((row) => row.updated_at.getTime()));
  return { articles, associations, updatedAt: new Date(newestUpdate).toISOString() };
}

const MATCH_KINDS = new Set<NewsStoryMatchKind>(["seed", "coverage", "evolution"]);
const MATCH_REASONS = new Set<NewsStoryMatchReason>([
  "new_story", "strict_title", "shared_name", "shared_anchors",
  "title_similarity", "summary_similarity", "time_proximity", "numbers_changed",
]);

function matchKind(value: string): NewsStoryMatchKind {
  return MATCH_KINDS.has(value as NewsStoryMatchKind) ? value as NewsStoryMatchKind : "seed";
}

function matchReasons(value: unknown): NewsStoryMatchReason[] {
  if (!Array.isArray(value)) return [];
  return value.filter((reason): reason is NewsStoryMatchReason =>
    typeof reason === "string" && MATCH_REASONS.has(reason as NewsStoryMatchReason));
}

function detailArticle(row: DetailArticleRow): NewsStoryArticle {
  const numericScore = Number(row.match_score);
  return {
    id: row.id,
    title: row.title,
    link: row.link,
    summary: row.summary,
    publishedAt: iso(row.published_at),
    category: row.category,
    source: row.source,
    coverageId: row.event_id,
    addedVersion: count(row.added_version),
    firstSeenAt: row.first_seen_at.toISOString(),
    revisionCount: count(row.revision_count),
    association: {
      kind: matchKind(row.match_kind),
      score: Number.isFinite(numericScore) ? Math.min(1, Math.max(0, numericScore)) : 0,
      reasons: matchReasons(row.match_reasons),
    },
  };
}

export async function loadNewsStoryDetail(id: string): Promise<NewsStoryDetailResponse | null> {
  if (!isNewsStoryId(id)) return null;
  const pool = newsStoryPool();
  if (!pool) return null;
  const client = await pool.connect();
  let discardClient = false;
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const storyResult = await client.query<PreviewRow>(
    `SELECT id::text AS story_id, article_count, event_count, first_published_at,
      latest_published_at, latest_article_id, version, updated_at
     FROM news_stories WHERE id = $1`,
    [id],
    );
    const storyRow = storyResult.rows[0];
    if (!storyRow) {
      await client.query("COMMIT");
      return null;
    }
    const eventResult = await client.query<EventRow>(
    `WITH event_data AS (
      SELECT event.id, MIN(article.published_at) AS published_at,
        event.first_activity_at
      FROM news_story_events event
      LEFT JOIN news_articles article ON article.event_id = event.id
      WHERE event.story_id = $1
      GROUP BY event.id, event.first_activity_at
    ), ranked AS (
      SELECT event_data.*,
        ROW_NUMBER() OVER (ORDER BY first_activity_at ASC, id ASC) AS earliest_rank,
        ROW_NUMBER() OVER (ORDER BY first_activity_at DESC, id DESC) AS recent_rank
      FROM event_data
    )
    SELECT id::text, published_at, first_activity_at FROM ranked
    WHERE earliest_rank = 1 OR recent_rank <= $2
    ORDER BY first_activity_at ASC, id ASC`,
    [id, MAX_DETAIL_EVENTS - 1],
    );
    let truncated = count(storyRow.event_count) > MAX_DETAIL_EVENTS
      || count(storyRow.article_count) > MAX_DETAIL_ARTICLES;
    const eventRows = eventResult.rows;
    const eventIds = eventRows.map(({ id: eventId }) => eventId);
    const articleResult = eventIds.length === 0 ? { rows: [] as DetailArticleRow[] } : await client.query<DetailArticleRow>(
    `WITH ranked AS (
      SELECT article.*,
        ROW_NUMBER() OVER (
          PARTITION BY article.event_id ORDER BY article.activity_at DESC, article.id ASC
        ) AS event_rank
      FROM news_articles article WHERE article.event_id = ANY($1::uuid[])
    ), chosen AS (
      SELECT * FROM ranked
      ORDER BY CASE WHEN event_rank = 1 THEN 0 ELSE 1 END ASC,
        CASE WHEN event_rank = 1 THEN activity_at END ASC,
        CASE WHEN event_rank > 1 THEN activity_at END DESC,
        id ASC
      LIMIT $2
    )
    SELECT chosen.id, chosen.event_id::text, chosen.title, chosen.link,
      chosen.summary, chosen.published_at, chosen.category, chosen.source,
      chosen.first_seen_at, chosen.added_version, chosen.match_kind,
      chosen.match_score, chosen.match_reasons,
      (SELECT COUNT(*) FROM news_article_revisions revision
       WHERE revision.article_id = chosen.id) AS revision_count
    FROM chosen ORDER BY chosen.activity_at ASC, chosen.id ASC`,
    [eventIds, MAX_DETAIL_ARTICLES],
    );
    if (articleResult.rows.length < Math.min(count(storyRow.article_count), MAX_DETAIL_ARTICLES)) {
      truncated = true;
    }
    const articles = articleResult.rows.map(detailArticle);
    const detail: NewsStoryDetailResponse = {
      story: preview(storyRow),
      events: eventRows.map((event) => ({
        id: event.id,
        publishedAt: iso(event.published_at),
        articles: articles.filter((article) => article.coverageId === event.id),
      })),
      updatedAt: storyRow.updated_at.toISOString(),
      truncated,
    };
    await client.query("COMMIT");
    return detail;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discardClient = true;
    }
    throw error;
  } finally {
    client.release(discardClient);
  }
}
