export type SnapshotCacheStatus = "hit" | "miss" | "refreshed" | "stale-if-error";

export type SnapshotCacheResult<T> = {
  status: SnapshotCacheStatus;
  value: T;
};

type SnapshotEntry<T> = {
  cachedAt: number;
  value: T;
};

export class InProcessSnapshotCache<T> {
  private entry: SnapshotEntry<T> | null = null;
  private inFlight: Promise<T> | null = null;
  private readonly now: () => number;
  private readonly staleRetryDelayMs: number;
  private readonly ttlMs: number;
  private retryStaleAt = 0;

  constructor(
    ttlMs: number,
    staleRetryDelayMs: number,
    now: () => number = Date.now,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      throw new RangeError("Snapshot cache TTL must be a positive finite number");
    }
    if (!Number.isFinite(staleRetryDelayMs) || staleRetryDelayMs < 0) {
      throw new RangeError("Snapshot cache stale retry delay must be a non-negative finite number");
    }
    this.now = now;
    this.staleRetryDelayMs = staleRetryDelayMs;
    this.ttlMs = ttlMs;
  }

  async get(refresh: () => Promise<T>): Promise<SnapshotCacheResult<T>> {
    const current = this.entry;
    if (current && this.now() - current.cachedAt < this.ttlMs) {
      return { status: "hit", value: current.value };
    }
    if (current && this.now() < this.retryStaleAt) {
      return { status: "stale-if-error", value: current.value };
    }

    const hadSnapshot = current !== null;
    let refreshPromise = this.inFlight;

    if (!refreshPromise) {
      refreshPromise = Promise.resolve()
        .then(refresh)
        .then((value) => {
          this.entry = { cachedAt: this.now(), value };
          this.retryStaleAt = 0;
          return value;
        });
      this.inFlight = refreshPromise;

      const clearInFlight = () => {
        if (this.inFlight === refreshPromise) this.inFlight = null;
      };
      void refreshPromise.then(clearInFlight, clearInFlight);
    }

    try {
      const value = await refreshPromise;
      return { status: hadSnapshot ? "refreshed" : "miss", value };
    } catch (error) {
      const stale = this.entry;
      if (stale) {
        this.retryStaleAt = this.now() + this.staleRetryDelayMs;
        return { status: "stale-if-error", value: stale.value };
      }
      throw error;
    }
  }
}
