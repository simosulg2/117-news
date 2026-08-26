export const NEWS_STORY_SCHEMA_VERSION = 1;

/**
 * Idempotent PostgreSQL bootstrap for optional news history. IDs are generated
 * by the application so the database does not require UUID extensions.
 */
export const NEWS_STORY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS news_stories (
    id UUID PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('Eesti', 'Majandus', 'Sport')),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    article_count INTEGER NOT NULL DEFAULT 0 CHECK (article_count >= 0),
    event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
    latest_article_id TEXT NOT NULL CHECK (char_length(latest_article_id) BETWEEN 1 AND 128),
    first_published_at TIMESTAMPTZ,
    latest_published_at TIMESTAMPTZ,
    first_activity_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (last_activity_at >= first_activity_at)
  );

  CREATE TABLE IF NOT EXISTS news_story_events (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES news_stories(id) ON DELETE CASCADE,
    anchor_article_id TEXT NOT NULL CHECK (char_length(anchor_article_id) BETWEEN 1 AND 128),
    anchor_title TEXT NOT NULL CHECK (char_length(anchor_title) BETWEEN 1 AND 1000),
    anchor_summary TEXT NOT NULL CHECK (char_length(anchor_summary) <= 2000),
    anchor_source TEXT NOT NULL CHECK (anchor_source IN ('ERR', 'Postimees', 'Lõuna PM')),
    anchor_published_at TIMESTAMPTZ,
    first_activity_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, story_id),
    CHECK (last_activity_at >= first_activity_at)
  );

  CREATE TABLE IF NOT EXISTS news_articles (
    id TEXT PRIMARY KEY CHECK (char_length(id) BETWEEN 1 AND 128),
    story_id UUID NOT NULL,
    event_id UUID NOT NULL,
    link TEXT NOT NULL UNIQUE CHECK (char_length(link) BETWEEN 1 AND 4096),
    source TEXT NOT NULL CHECK (source IN ('ERR', 'Postimees', 'Lõuna PM')),
    category TEXT NOT NULL CHECK (category IN ('Eesti', 'Majandus', 'Sport')),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 1000),
    summary TEXT NOT NULL CHECK (char_length(summary) <= 2000),
    published_at TIMESTAMPTZ,
    activity_at TIMESTAMPTZ NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    added_version INTEGER NOT NULL CHECK (added_version >= 1),
    match_kind TEXT NOT NULL CHECK (match_kind IN ('seed', 'coverage', 'evolution')),
    match_score DOUBLE PRECISION NOT NULL CHECK (match_score >= 0 AND match_score <= 1),
    match_reasons JSONB NOT NULL DEFAULT '[]'::JSONB,
    matched_article_id TEXT CHECK (
      matched_article_id IS NULL OR char_length(matched_article_id) BETWEEN 1 AND 128
    ),
    FOREIGN KEY (event_id, story_id)
      REFERENCES news_story_events(id, story_id)
      ON DELETE CASCADE,
    CHECK (last_seen_at >= first_seen_at),
    CHECK (jsonb_typeof(match_reasons) = 'array'),
    CHECK (octet_length(match_reasons::TEXT) <= 2048)
  );

  CREATE TABLE IF NOT EXISTS news_article_revisions (
    article_id TEXT NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 1000),
    summary TEXT NOT NULL CHECK (char_length(summary) <= 2000),
    published_at TIMESTAMPTZ,
    category TEXT NOT NULL CHECK (category IN ('Eesti', 'Majandus', 'Sport')),
    source TEXT NOT NULL CHECK (source IN ('ERR', 'Postimees', 'Lõuna PM')),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    story_version INTEGER NOT NULL CHECK (story_version >= 1),
    PRIMARY KEY (article_id, content_hash)
  );

  CREATE INDEX IF NOT EXISTS news_stories_activity_idx
    ON news_stories (category, last_activity_at DESC, id);
  CREATE INDEX IF NOT EXISTS news_stories_retention_idx
    ON news_stories (last_activity_at ASC, id);
  CREATE INDEX IF NOT EXISTS news_story_events_story_idx
    ON news_story_events (story_id, first_activity_at ASC, id);
  CREATE INDEX IF NOT EXISTS news_articles_story_idx
    ON news_articles (story_id, activity_at DESC, id);
  CREATE INDEX IF NOT EXISTS news_articles_event_idx
    ON news_articles (event_id, activity_at ASC, id);
  CREATE INDEX IF NOT EXISTS news_articles_last_seen_idx
    ON news_articles (last_seen_at DESC);
  CREATE INDEX IF NOT EXISTS news_article_revisions_article_idx
    ON news_article_revisions (article_id, observed_at ASC);
`;
