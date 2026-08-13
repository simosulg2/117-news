import {
  FEED_REQUEST_TIMEOUT_MS,
  MAX_FEED_BYTES,
  MAX_FEED_REDIRECTS,
  type FeedDefinition,
} from "@/features/news/server/feed-config";
import { feedResponseDetails } from "@/features/news/server/feed-content";
import { allowedFeedRequestUrl } from "@/lib/feed-links";
import { FeedLoadError, normalizeFeedRequestError } from "@/lib/feed-retry";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function discardBody(response: Response): Promise<void> {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // The redirect response is no longer needed; cancellation is best-effort.
  }
}

export async function fetchFeedResponse(feed: FeedDefinition, headers: HeadersInit): Promise<Response> {
  const signal = AbortSignal.timeout(FEED_REQUEST_TIMEOUT_MS);
  let currentUrl = allowedFeedRequestUrl(feed.url, feed.allowedRoot);
  if (!currentUrl) {
    throw new FeedLoadError("configuration", "Configured feed URL is outside the approved HTTPS host");
  }

  for (let redirectCount = 0; redirectCount <= MAX_FEED_REDIRECTS; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        cache: "no-store",
        headers,
        redirect: "manual",
        signal,
      });
    } catch (error) {
      throw normalizeFeedRequestError(error);
    }

    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get("location");
    if (!location) {
      await discardBody(response);
      throw new FeedLoadError(
        "redirect",
        `Feed redirect had no destination (${feedResponseDetails(response)})`,
      );
    }
    if (redirectCount === MAX_FEED_REDIRECTS) {
      await discardBody(response);
      throw new FeedLoadError(
        "redirect",
        `Feed exceeded ${MAX_FEED_REDIRECTS} redirects (${feedResponseDetails(response)})`,
      );
    }

    const nextUrl = allowedFeedRequestUrl(location, feed.allowedRoot, currentUrl.toString());
    if (!nextUrl) {
      await discardBody(response);
      throw new FeedLoadError(
        "redirect",
        `Feed redirect left the approved HTTPS host (${feedResponseDetails(response)})`,
      );
    }

    await discardBody(response);
    currentUrl = nextUrl;
  }

  throw new FeedLoadError("redirect", "Feed redirect handling ended unexpectedly");
}

export async function readBodyPrefix(response: Response, maxBytes = 2_048): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remaining = maxBytes;
  let text = "";

  try {
    while (remaining > 0) {
      const { done, value } = await reader.read();
      if (done) {
        text += decoder.decode();
        return text;
      }

      const chunk = value.subarray(0, remaining);
      text += decoder.decode(chunk, { stream: true });
      remaining -= chunk.byteLength;

      if (chunk.byteLength < value.byteLength) break;
    }

    await reader.cancel();
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export async function readFeedBody(response: Response): Promise<{ bytes: number; text: string }> {
  const declaredLength = response.headers.get("content-length")?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const declaredBytes = Number(declaredLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_FEED_BYTES) {
      await discardBody(response);
      throw new FeedLoadError(
        "response_too_large",
        `Feed response was unexpectedly large (${feedResponseDetails(response)}; bytes=${declaredBytes})`,
      );
    }
  }

  if (!response.body) return { bytes: 0, text: "" };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > MAX_FEED_BYTES) {
        await reader.cancel();
        throw new FeedLoadError(
          "response_too_large",
          `Feed response was unexpectedly large (${feedResponseDetails(response)}; bytes>${MAX_FEED_BYTES})`,
        );
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { bytes, text };
  } finally {
    reader.releaseLock();
  }
}
