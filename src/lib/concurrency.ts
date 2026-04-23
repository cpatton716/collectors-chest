/**
 * Concurrency utilities for async task orchestration.
 *
 * Used primarily by cron jobs and batch-processing pipelines where we need
 * to fan-out async work (API calls, emails, etc.) without overwhelming
 * downstream services or exceeding rate limits.
 */

/**
 * Run async tasks in parallel with a concurrency limit.
 *
 * Results are returned in the same order as the input array, regardless of
 * completion order. If any task throws, the returned promise rejects with
 * that error (matching `Promise.all` semantics). In-flight workers continue
 * to completion before the rejection propagates, but additional tasks will
 * not be picked up from the queue once a rejection is observed.
 *
 * Use `mapWithConcurrencySettled` for independent per-task error handling.
 *
 * @param items        Input array
 * @param concurrency  Max workers running in parallel. `Infinity` runs all
 *                     tasks in parallel (equivalent to `Promise.all`).
 * @param fn           Task to run for each item. Receives `(item, index)`.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const effectiveConcurrency = Math.max(
    1,
    Math.min(concurrency, items.length)
  );

  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) {
        return;
      }
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from({ length: effectiveConcurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Like `mapWithConcurrency` but never rejects: each task's outcome is
 * returned as a `{ status: 'fulfilled' | 'rejected' }` descriptor.
 *
 * Useful when one failing task should not abort the rest — e.g. sending
 * 50 emails where one bad recipient address shouldn't block the others.
 */
export async function mapWithConcurrencySettled<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  return mapWithConcurrency(items, concurrency, async (item, i) => {
    try {
      const value = await fn(item, i);
      return { status: "fulfilled", value } as PromiseSettledResult<R>;
    } catch (reason) {
      return { status: "rejected", reason } as PromiseSettledResult<R>;
    }
  });
}

/**
 * Split an array into chunks of at most `size` items.
 *
 * Handy for Resend's `batch.send()` (max 100/call) or any API with
 * per-request payload limits.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error(`chunk size must be > 0 (got ${size})`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
