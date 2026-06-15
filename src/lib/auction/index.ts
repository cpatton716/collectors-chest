// Internal barrel for the auction submodules (R1-auctiondb / M-AU9).
//
// This re-exports submodule members for ergonomic intra-package imports and
// tests. Application code MUST continue to import the public surface from
// "@/lib/auctionDb" (the behavior-preserving re-export barrel), NOT from here.
//
// NOTE: submodules import directly from sibling submodules (e.g. "./transforms")
// and never from this index, to keep the dependency graph acyclic.

export * from "./shared";
export * from "./columns";
export * from "./transforms";
export * from "./auctions";
export * from "./bids";
export * from "./watchlist";
export * from "./offers";
export * from "./notifications";
export * from "./ratings";
export * from "./cron";
export * from "./secondChance";
