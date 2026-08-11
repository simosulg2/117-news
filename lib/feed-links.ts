export type FeedRoot = "err.ee" | "postimees.ee";

function normalizeUrl(value: string | undefined, baseUrl?: string): URL | null {
  if (!value) return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  try {
    const url = baseUrl ? new URL(trimmedValue, baseUrl) : new URL(trimmedValue);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function matchesRoot(hostname: string, root: FeedRoot): boolean {
  return hostname === root || hostname.endsWith(`.${root}`);
}

function isAllowedArticleHost(hostname: string, root: FeedRoot): boolean {
  return matchesRoot(hostname, root) || (root === "postimees.ee" && hostname === "pmo.ee");
}

export function canonicalArticleLink(
  value: string | undefined,
  root: FeedRoot,
  baseUrl?: string,
): string | null {
  const url = normalizeUrl(value, baseUrl);
  if (!url || !isAllowedArticleHost(url.hostname, root)) return null;

  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLocaleLowerCase("en-US");
    if (
      normalizedKey.startsWith("utm_")
      || normalizedKey === "ref"
      || normalizedKey === "fbclid"
      || normalizedKey === "gclid"
    ) {
      url.searchParams.delete(key);
    }
  }
  return url.toString();
}

export function resolveArticleLink(
  link: string | undefined,
  guid: string | undefined,
  root: FeedRoot,
  feedUrl: string,
): string | null {
  const itemLink = canonicalArticleLink(link, root, feedUrl);
  if (itemLink) return itemLink;

  // GUIDs are identifiers unless they are already absolute URLs. Resolving an
  // opaque GUID against the feed URL can turn values like `pm#123` into `/pm`.
  const absoluteGuidLink = canonicalArticleLink(guid, root);
  if (absoluteGuidLink) return absoluteGuidLink;

  if (root === "postimees.ee") {
    const postimeesId = guid?.trim().match(/^pm#(\d+)$/i)?.[1];
    if (postimeesId) return `https://pmo.ee/${postimeesId}`;
  }

  return null;
}

export function allowedFeedRequestUrl(
  value: string,
  root: FeedRoot,
  baseUrl?: string,
): URL | null {
  try {
    const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
    const standardHttpsPort = url.port === "";
    const hasNoCredentials = url.username === "" && url.password === "";
    return url.protocol === "https:" && standardHttpsPort && hasNoCredentials && matchesRoot(url.hostname, root)
      ? url
      : null;
  } catch {
    return null;
  }
}
