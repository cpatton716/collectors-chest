import { supabaseAdmin } from "@/lib/supabase";

/**
 * All auction marketplace audit event types. Must stay in sync with the
 * `auction_audit_event_type` Postgres enum defined in
 * supabase/migrations/20260423_auction_audit_log.sql.
 */
export type AuctionAuditEventType =
  | "auction_created"
  | "auction_activated"
  | "auction_ended"
  | "auction_cancelled"
  | "auction_payment_expired"
  | "auction_completed"
  | "bid_placed"
  | "bid_won"
  | "bid_lost"
  | "offer_created"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_countered"
  | "offer_expired"
  | "payment_initiated"
  | "payment_succeeded"
  | "payment_failed"
  | "payment_refunded"
  | "shipment_created"
  | "listing_expired"
  | "user_flagged";

export interface AuditEventInput {
  auctionId?: string | null;
  offerId?: string | null;
  actorProfileId?: string | null;
  eventType: AuctionAuditEventType;
  eventData?: Record<string, unknown>;
}

/**
 * Build the DB row for an AuditEventInput. Extracted so the batch helper
 * and single-event helper share the same input-massaging logic (and so unit
 * tests can exercise it without mocking Supabase).
 */
export function buildAuditLogRow(event: AuditEventInput): {
  auction_id: string | null;
  offer_id: string | null;
  actor_profile_id: string | null;
  event_type: AuctionAuditEventType;
  event_data: Record<string, unknown>;
} {
  return {
    auction_id: event.auctionId ?? null,
    offer_id: event.offerId ?? null,
    actor_profile_id: event.actorProfileId ?? null,
    event_type: event.eventType,
    event_data: event.eventData ?? {},
  };
}

/**
 * Log a single auction audit event. Never throws — audit failures must never
 * cascade into user-facing errors. Fire-and-forget: caller should use
 * `void logAuctionAuditEvent(...)` in hot paths to make intent explicit.
 */
export async function logAuctionAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("auction_audit_log")
      .insert(buildAuditLogRow(event));
    if (error) {
      console.warn(
        "[auditLog] failed to insert event:",
        event.eventType,
        error
      );
    }
  } catch (err) {
    console.warn("[auditLog] unexpected error:", event.eventType, err);
  }
}

/**
 * Batch-insert multiple audit events in a single DB round-trip. Used by
 * cron paths that process many items at once. Also fire-and-forget safe.
 */
export async function logAuctionAuditEvents(events: AuditEventInput[]): Promise<void> {
  if (events.length === 0) return;
  try {
    const rows = events.map(buildAuditLogRow);
    const { error } = await supabaseAdmin.from("auction_audit_log").insert(rows);
    if (error) {
      console.warn(
        "[auditLog] batch insert failed:",
        events.length,
        "events:",
        error
      );
    }
  } catch (err) {
    console.warn("[auditLog] batch unexpected error:", err);
  }
}
