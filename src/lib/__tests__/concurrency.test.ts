import {
  chunk,
  mapWithConcurrency,
  mapWithConcurrencySettled,
} from "../concurrency";

// Small helper to resolve after N ms, so we can verify concurrency caps
// by observing the max number of in-flight tasks.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("mapWithConcurrency", () => {
  it("returns empty array for empty input", async () => {
    const fn = jest.fn(async (x: number) => x * 2);
    const result = await mapWithConcurrency([], 5, fn);
    expect(result).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns results in input order even when tasks finish out of order", async () => {
    // First item takes longest, last item finishes first.
    const delays = [30, 10, 20, 5, 15];
    const result = await mapWithConcurrency(delays, 5, async (ms, i) => {
      await delay(ms);
      return i;
    });
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("runs serially when concurrency is 1", async () => {
    const timeline: Array<{ i: number; event: "start" | "end" }> = [];
    await mapWithConcurrency([0, 1, 2, 3], 1, async (_item, i) => {
      timeline.push({ i, event: "start" });
      await delay(5);
      timeline.push({ i, event: "end" });
      return i;
    });

    // Each task's end must precede the next task's start.
    for (let i = 0; i < 3; i++) {
      const endIdx = timeline.findIndex(
        (e) => e.i === i && e.event === "end"
      );
      const nextStartIdx = timeline.findIndex(
        (e) => e.i === i + 1 && e.event === "start"
      );
      expect(endIdx).toBeLessThan(nextStartIdx);
    }
  });

  it("respects the concurrency cap (never exceeds N in flight)", async () => {
    const concurrency = 3;
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(
      Array.from({ length: 12 }, (_, i) => i),
      concurrency,
      async (i) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(10);
        inFlight--;
        return i;
      }
    );

    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
    expect(maxInFlight).toBeGreaterThan(1); // sanity: we did get parallelism
  });

  it("runs all tasks in parallel when concurrency is Infinity", async () => {
    const n = 8;
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(
      Array.from({ length: n }, (_, i) => i),
      Infinity,
      async (i) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(10);
        inFlight--;
        return i;
      }
    );

    expect(maxInFlight).toBe(n);
  });

  it("propagates the first rejection (Promise.all semantics)", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error("boom");
        return x;
      })
    ).rejects.toThrow("boom");
  });

  it("passes both item and index to the worker fn", async () => {
    const seen: Array<[string, number]> = [];
    await mapWithConcurrency(["a", "b", "c"], 2, async (item, index) => {
      seen.push([item, index]);
      return item;
    });
    expect(seen.sort()).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("handles concurrency larger than item count", async () => {
    const result = await mapWithConcurrency([1, 2, 3], 100, async (x) => x * 2);
    expect(result).toEqual([2, 4, 6]);
  });
});

describe("mapWithConcurrencySettled", () => {
  it("returns fulfilled/rejected descriptors and does not throw", async () => {
    const result = await mapWithConcurrencySettled(
      [1, 2, 3, 4],
      2,
      async (x) => {
        if (x === 2) throw new Error("two failed");
        return x * 10;
      }
    );

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(result[1].status).toBe("rejected");
    if (result[1].status === "rejected") {
      expect((result[1].reason as Error).message).toBe("two failed");
    }
    expect(result[2]).toEqual({ status: "fulfilled", value: 30 });
    expect(result[3]).toEqual({ status: "fulfilled", value: 40 });
  });
});

describe("chunk", () => {
  it("splits array into fixed-size chunks", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("returns a single chunk when size >= length", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("throws for non-positive size", () => {
    expect(() => chunk([1, 2], 0)).toThrow();
    expect(() => chunk([1, 2], -1)).toThrow();
  });
});
