/**
 * Want-count tally tests (H-MK4).
 *
 * `tallyWantCounts` replaces the previous per-comic N+1 `count` query with an
 * in-JS tally over a single batched key_hunt_lists fetch. This is the matching
 * logic that drives the "X collectors want this" badge on tradeable comics, so
 * its correctness is load-bearing for the marketplace surface.
 *
 * The route module imports Supabase/Clerk/db; we stub them so importing the
 * exported pure helper never constructs a client or touches the network.
 */

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() })),
}));

// next/server pulls in Edge runtime globals (Request/Response) that aren't
// present under jsdom. We only test the route's exported pure helper, so stub it.
jest.mock("next/server", () => ({
  NextResponse: { json: jest.fn() },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: { from: jest.fn() },
}));

jest.mock("@/lib/db", () => ({
  getProfileByClerkId: jest.fn(),
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn(),
}));

import { tallyWantCounts, type HuntListRow, type WantCountComic } from "../route";

const COMIC = (
  id: string,
  title: string | null,
  issue: string | null,
  owner: string | null
): WantCountComic => ({ id, title, issue_number: issue, ownerClerkId: owner });

const HUNT = (
  user: string | null,
  title: string | null,
  issue: string | null
): HuntListRow => ({ user_id: user, title_normalized: title, issue_number: issue });

describe("tallyWantCounts", () => {
  it("counts each distinct wanter for a matching comic", () => {
    const comics = [COMIC("c1", "Amazing Spider-Man", "300", "owner-clerk")];
    const hunts = [
      HUNT("clerk-a", "amazing spider-man", "300"),
      HUNT("clerk-b", "amazing spider-man", "300"),
    ];
    const result = tallyWantCounts(comics, hunts);
    expect(result.get("c1")).toBe(2);
  });

  it("excludes the comic's own owner from its want count", () => {
    const comics = [COMIC("c1", "Hulk", "181", "owner-clerk")];
    const hunts = [
      HUNT("owner-clerk", "hulk", "181"), // owner wanting their own book -> not counted
      HUNT("clerk-b", "hulk", "181"),
    ];
    expect(tallyWantCounts(comics, hunts).get("c1")).toBe(1);
  });

  it("counts a single wanter once even if duplicated in the hunt rows", () => {
    const comics = [COMIC("c1", "X-Men", "1", "owner")];
    const hunts = [
      HUNT("clerk-a", "x-men", "1"),
      HUNT("clerk-a", "x-men", "1"), // dup -> deduped to one
    ];
    expect(tallyWantCounts(comics, hunts).get("c1")).toBe(1);
  });

  it("normalizes the comic title before matching (case/whitespace)", () => {
    const comics = [COMIC("c1", "  Daredevil  ", "168", "owner")];
    const hunts = [HUNT("clerk-a", "daredevil", "168")];
    expect(tallyWantCounts(comics, hunts).get("c1")).toBe(1);
  });

  it("requires an exact issue-number match", () => {
    const comics = [COMIC("c1", "Batman", "1", "owner")];
    const hunts = [HUNT("clerk-a", "batman", "2")];
    expect(tallyWantCounts(comics, hunts).get("c1")).toBe(0);
  });

  it("returns 0 for comics missing title or issue", () => {
    const comics = [
      COMIC("c1", null, "1", "owner"),
      COMIC("c2", "Thor", null, "owner"),
    ];
    const hunts = [HUNT("clerk-a", "thor", "1")];
    const result = tallyWantCounts(comics, hunts);
    expect(result.get("c1")).toBe(0);
    expect(result.get("c2")).toBe(0);
  });

  it("ignores hunt rows missing required fields", () => {
    const comics = [COMIC("c1", "Venom", "1", "owner")];
    const hunts = [
      HUNT(null, "venom", "1"),
      HUNT("clerk-a", null, "1"),
      HUNT("clerk-a", "venom", null),
      HUNT("clerk-valid", "venom", "1"),
    ];
    expect(tallyWantCounts(comics, hunts).get("c1")).toBe(1);
  });

  it("tallies multiple comics independently from one batch", () => {
    const comics = [
      COMIC("c1", "Spider-Man", "1", "owner-1"),
      COMIC("c2", "Iron Man", "1", "owner-2"),
    ];
    const hunts = [
      HUNT("a", "spider-man", "1"),
      HUNT("b", "spider-man", "1"),
      HUNT("c", "iron man", "1"),
    ];
    const result = tallyWantCounts(comics, hunts);
    expect(result.get("c1")).toBe(2);
    expect(result.get("c2")).toBe(1);
  });
});
