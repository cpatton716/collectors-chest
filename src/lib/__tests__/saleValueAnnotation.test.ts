/**
 * Sold-Value Annotation Helper Tests (H-CO1 / Batch B11)
 *
 * Covers the pure helpers that drive the "some sold books have no recorded
 * sale price" disclaimer shown anywhere realized revenue / profit / total-sold
 * value is displayed (Sales History page). Build-safe behavior is critical:
 * the `sale_price_recorded` flag is migration-staged, so a missing/undefined
 * flag MUST be treated as "recorded".
 */
import {
  countUnrecordedSalePrices,
  getSoldValueAnnotation,
  type SoldValueAnnotationInput,
} from "@/components/CollectionStats";

describe("countUnrecordedSalePrices", () => {
  it("returns 0 for an empty list", () => {
    expect(countUnrecordedSalePrices([])).toBe(0);
  });

  it("treats a missing flag (pre-migration) as recorded", () => {
    const sales: SoldValueAnnotationInput[] = [{}, {}, {}];
    expect(countUnrecordedSalePrices(sales)).toBe(0);
  });

  it("treats undefined and null as recorded", () => {
    const sales: SoldValueAnnotationInput[] = [
      { salePriceRecorded: undefined },
      { salePriceRecorded: null },
    ];
    expect(countUnrecordedSalePrices(sales)).toBe(0);
  });

  it("treats true as recorded", () => {
    const sales: SoldValueAnnotationInput[] = [
      { salePriceRecorded: true },
      { salePriceRecorded: true },
    ];
    expect(countUnrecordedSalePrices(sales)).toBe(0);
  });

  it("counts only explicit false values", () => {
    const sales: SoldValueAnnotationInput[] = [
      { salePriceRecorded: true },
      { salePriceRecorded: false },
      {},
      { salePriceRecorded: false },
      { salePriceRecorded: null },
    ];
    expect(countUnrecordedSalePrices(sales)).toBe(2);
  });

  it("is defensive against a non-array input", () => {
    // @ts-expect-error intentionally passing an invalid value
    expect(countUnrecordedSalePrices(undefined)).toBe(0);
  });
});

describe("getSoldValueAnnotation", () => {
  it("returns null when every sale has a recorded price", () => {
    const sales: SoldValueAnnotationInput[] = [
      { salePriceRecorded: true },
      {},
      { salePriceRecorded: null },
    ];
    expect(getSoldValueAnnotation(sales)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(getSoldValueAnnotation([])).toBeNull();
  });

  it("flags a single unrecorded sale with singular wording", () => {
    const sales: SoldValueAnnotationInput[] = [{ salePriceRecorded: false }, {}];
    const annotation = getSoldValueAnnotation(sales);
    expect(annotation).not.toBeNull();
    expect(annotation?.hasUnrecorded).toBe(true);
    expect(annotation?.unrecordedCount).toBe(1);
    expect(annotation?.footnote).toBe("* Excludes 1 sold book with no recorded sale price.");
  });

  it("flags multiple unrecorded sales with plural wording", () => {
    const sales: SoldValueAnnotationInput[] = [
      { salePriceRecorded: false },
      { salePriceRecorded: false },
      { salePriceRecorded: false },
      { salePriceRecorded: true },
    ];
    const annotation = getSoldValueAnnotation(sales);
    expect(annotation?.unrecordedCount).toBe(3);
    expect(annotation?.footnote).toBe("* Excludes 3 sold books with no recorded sale price.");
  });
});

/**
 * Documents the revenue-math contract the Sales page relies on: rows with an
 * explicit `salePriceRecorded === false` contribute NOTHING to revenue / profit
 * (treated as "no value"), and the average denominator is the recorded count.
 */
describe("revenue math excludes unrecorded-price sales", () => {
  interface Sale extends SoldValueAnnotationInput {
    salePrice: number;
    profit: number;
  }

  const reduceRecorded = (sales: Sale[]) => {
    let totalSales = 0;
    let totalProfit = 0;
    let valuedCount = 0;
    for (const s of sales) {
      if (s.salePriceRecorded === false) continue;
      totalSales += s.salePrice;
      totalProfit += s.profit;
      valuedCount++;
    }
    return {
      totalSales,
      totalProfit,
      avgProfit: valuedCount > 0 ? totalProfit / valuedCount : 0,
      valuedCount,
    };
  };

  it("ignores unrecorded rows in totals and average", () => {
    const sales: Sale[] = [
      { salePrice: 100, profit: 40, salePriceRecorded: true },
      { salePrice: 60, profit: 20 }, // missing flag => recorded
      { salePrice: 0, profit: 0, salePriceRecorded: false }, // excluded
    ];
    const result = reduceRecorded(sales);
    expect(result.totalSales).toBe(160);
    expect(result.totalProfit).toBe(60);
    expect(result.valuedCount).toBe(2);
    expect(result.avgProfit).toBe(30);
  });

  it("yields zeros when all sales are unrecorded", () => {
    const sales: Sale[] = [
      { salePrice: 0, profit: 0, salePriceRecorded: false },
      { salePrice: 0, profit: 0, salePriceRecorded: false },
    ];
    const result = reduceRecorded(sales);
    expect(result.totalSales).toBe(0);
    expect(result.totalProfit).toBe(0);
    expect(result.avgProfit).toBe(0);
    expect(result.valuedCount).toBe(0);
  });
});
