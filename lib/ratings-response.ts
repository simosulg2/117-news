const GENERIC_STATIC_JSON_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/binary",
  "binary/octet-stream",
  "text/json",
  "text/plain",
]);

export class RatingsResponseReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatingsResponseReadError";
  }
}

function mimeEssence(value: string): string {
  return value.split(";", 1)[0].trim().toLocaleLowerCase("en-US");
}

/**
 * The ratings URL is a fixed, trusted source, so common generic MIME types
 * used by static/CDN hosts may proceed to the bounded JSON parser. This must
 * not be used to decide whether an arbitrary user-controlled URL is safe.
 */
export function ratingsContentTypeMayContainJson(contentType: string | null): boolean {
  if (!contentType?.trim()) return true;
  const mime = mimeEssence(contentType);
  return mime === "application/json"
    || mime.endsWith("+json")
    || GENERIC_STATIC_JSON_MIME_TYPES.has(mime);
}

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!body) return;
  try {
    await body.cancel();
  } catch {
    // Cancellation is best-effort after rejecting an oversized response.
  }
}

/** Reads a UTF-8 response without ever buffering more than `maximumBytes`. */
export async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new RangeError("maximumBytes must be a non-negative safe integer");
  }

  const declaredLength = response.headers.get("content-length")?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maximumBytes) {
    await cancelBody(response.body);
    throw new RatingsResponseReadError("Ratings response exceeded its size limit");
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size violation remains authoritative if cancellation fails.
        }
        throw new RatingsResponseReadError("Ratings response exceeded its size limit");
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}
