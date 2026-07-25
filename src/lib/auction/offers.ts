// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

import {
  CreateOfferInput,
  Offer,
  RespondToOfferInput,
  calculatePaymentDeadline,
} from "@/types/auction";

import {
  sendNotificationEmail,
  getProfileForEmail,
  getListingComicData,
} from "../email";
import { logAuctionAuditEvent } from "../auditLog";
import { createFeedbackReminders } from "../creatorCreditsDb";
import { supabase, supabaseAdmin } from "../supabase";
import { transformOffer } from "./transforms";
import { createNotification } from "./notifications";

// ============================================================================
// OFFERS
// ============================================================================

/**
 * Create a new offer on a fixed-price listing
 */
export async function createOffer(
  buyerId: string,
  input: CreateOfferInput
): Promise<{ success: boolean; offer?: Offer; error?: string }> {
  // Get the listing
  const { data: listing } = await supabase
    .from("auctions")
    .select("*, profiles!auctions_seller_id_fkey(id)")
    .eq("id", input.listingId)
    .eq("status", "active")
    .eq("listing_type", "fixed_price")
    .single();

  if (!listing) {
    return { success: false, error: "Listing not found or no longer available" };
  }

  if (listing.seller_id === buyerId) {
    return { success: false, error: "You cannot make an offer on your own listing" };
  }

  if (!listing.accepts_offers) {
    return { success: false, error: "This listing does not accept offers" };
  }

  // Check if offer is below minimum
  if (listing.min_offer_amount && input.amount < listing.min_offer_amount) {
    // Auto-reject without notifying seller
    return { success: false, error: "Your offer is too low for this listing" };
  }

  // Check for existing pending offer from this buyer
  const { data: existingOffer } = await supabase
    .from("offers")
    .select("id, status, round_number")
    .eq("listing_id", input.listingId)
    .eq("buyer_id", buyerId)
    .in("status", ["pending", "countered"])
    .maybeSingle();

  if (existingOffer) {
    return { success: false, error: "You already have an active offer on this listing" };
  }

  // Create the offer
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const { data, error } = await supabase
    .from("offers")
    .insert({
      listing_id: input.listingId,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      amount: input.amount,
      status: "pending",
      round_number: 1,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Notify seller
  await createNotification(listing.seller_id, "offer_received", input.listingId, data.id);

  // Send offer_received email (fire and forget)
  (async () => {
    const [recipientProfile, otherProfile, comicData] = await Promise.all([
      getProfileForEmail(listing.seller_id),
      getProfileForEmail(buyerId),
      getListingComicData(input.listingId),
    ]);
    if (recipientProfile?.email && comicData) {
      sendNotificationEmail({
        to: recipientProfile.email,
        type: "offer_received",
        data: {
          buyerName: otherProfile?.displayName ?? "A buyer",
          sellerName: recipientProfile.displayName ?? "Seller",
          comicTitle: comicData.comicTitle,
          issueNumber: comicData.issueNumber,
          amount: input.amount,
          listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${input.listingId}`,
        },
      }).catch((err) => console.error("[Email] offer_received failed:", err));
    }
  })();

  // Audit trail - fire-and-forget.
  void logAuctionAuditEvent({
    auctionId: input.listingId,
    offerId: data.id,
    actorProfileId: buyerId,
    eventType: "offer_created",
    eventData: {
      amount: input.amount,
      roundNumber: 1,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { success: true, offer: transformOffer(data) };
}

/**
 * Respond to an offer (accept, reject, or counter)
 */
export async function respondToOffer(
  sellerId: string,
  input: RespondToOfferInput
): Promise<{ success: boolean; offer?: Offer; error?: string }> {
  // Get the offer
  const { data: offer } = await supabase
    .from("offers")
    .select("*, auctions(*)")
    .eq("id", input.offerId)
    .eq("seller_id", sellerId)
    .single();

  if (!offer) {
    return { success: false, error: "Offer not found" };
  }

  if (offer.status !== "pending" && offer.status !== "countered") {
    return { success: false, error: "This offer can no longer be modified" };
  }

  const now = new Date().toISOString();

  if (input.action === "accept") {
    // Accept the offer - complete the sale
    const paymentDeadline = calculatePaymentDeadline();

    // Atomic listing-status guard: only flip the listing to sold if it is
    // still active. The .eq("status", "active") + .select() makes a second
    // concurrent accept (or a Buy It Now in flight) a no-op we can detect via
    // zero rows, so the same comic can't be sold twice. Done BEFORE marking
    // the offer accepted so a failed guard leaves the offer untouched. H-MK1.
    const { data: soldRows, error: listingError } = await supabaseAdmin
      .from("auctions")
      .update({
        status: "sold",
        winner_id: offer.buyer_id,
        winning_bid: offer.amount,
        payment_status: "pending",
        payment_deadline: paymentDeadline.toISOString(),
      })
      .eq("id", offer.listing_id)
      .eq("status", "active")
      .select("id");

    if (listingError) {
      return { success: false, error: listingError.message };
    }
    if (!soldRows || soldRows.length === 0) {
      return {
        success: false,
        error: "This listing is no longer available",
      };
    }

    // Update accepted offer status
    await supabase
      .from("offers")
      .update({ status: "accepted", responded_at: now })
      .eq("id", input.offerId);

    // Auto-reject every other still-open offer on this listing — once the
    // comic is sold, competing offers can never be honored. H-MK1.
    await supabaseAdmin
      .from("offers")
      .update({ status: "auto_rejected", updated_at: now })
      .eq("listing_id", offer.listing_id)
      .neq("id", input.offerId)
      .in("status", ["pending", "countered"]);

    // Notify buyer
    await createNotification(offer.buyer_id, "offer_accepted", offer.listing_id, input.offerId);

    // Send offer_accepted email (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.buyer_id),
        getProfileForEmail(sellerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_accepted",
          data: {
            buyerName: recipientProfile.displayName ?? "Buyer",
            sellerName: otherProfile?.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_accepted failed:", err));
      }
    })();

    // Create feedback reminders for both parties (offer acceptance is a "sale")
    await createFeedbackReminders("sale", offer.listing_id, offer.buyer_id, sellerId);

    // Audit trail - fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId: input.offerId,
      actorProfileId: sellerId,
      eventType: "offer_accepted",
      eventData: {
        amount: offer.amount,
        roundNumber: offer.round_number,
        acceptedBy: "seller",
      },
    });

    return { success: true };
  }

  if (input.action === "reject") {
    await supabase
      .from("offers")
      .update({ status: "rejected", responded_at: now })
      .eq("id", input.offerId);

    // Notify buyer
    await createNotification(offer.buyer_id, "offer_rejected", offer.listing_id, input.offerId);

    // Send offer_rejected email (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.buyer_id),
        getProfileForEmail(sellerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_rejected",
          data: {
            buyerName: recipientProfile.displayName ?? "Buyer",
            sellerName: otherProfile?.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_rejected failed:", err));
      }
    })();

    // Audit trail - fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId: input.offerId,
      actorProfileId: sellerId,
      eventType: "offer_rejected",
      eventData: {
        amount: offer.amount,
        roundNumber: offer.round_number,
        rejectedBy: "seller",
      },
    });

    return { success: true };
  }

  if (input.action === "counter") {
    if (!input.counterAmount) {
      return { success: false, error: "Counter amount is required" };
    }

    if (offer.round_number >= 3) {
      return { success: false, error: "Maximum negotiation rounds reached (3)" };
    }

    // Update offer with counter
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 48);

    const { data: updatedOffer, error } = await supabase
      .from("offers")
      .update({
        status: "countered",
        counter_amount: input.counterAmount,
        round_number: offer.round_number + 1,
        expires_at: newExpiresAt.toISOString(),
        responded_at: now,
      })
      .eq("id", input.offerId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Notify buyer
    await createNotification(offer.buyer_id, "offer_countered", offer.listing_id, input.offerId);

    // Send offer_countered email (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.buyer_id),
        getProfileForEmail(sellerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_countered",
          data: {
            buyerName: recipientProfile.displayName ?? "Buyer",
            sellerName: otherProfile?.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.amount,
            counterAmount: input.counterAmount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_countered failed:", err));
      }
    })();

    // Audit trail - fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId: input.offerId,
      actorProfileId: sellerId,
      eventType: "offer_countered",
      eventData: {
        originalAmount: offer.amount,
        counterAmount: input.counterAmount,
        roundNumber: offer.round_number + 1,
        counteredBy: "seller",
        expiresAt: newExpiresAt.toISOString(),
      },
    });

    return { success: true, offer: transformOffer(updatedOffer) };
  }

  return { success: false, error: "Invalid action" };
}

/**
 * Respond to a counter-offer (buyer accepts or rejects)
 */
export async function respondToCounterOffer(
  buyerId: string,
  offerId: string,
  action: "accept" | "reject"
): Promise<{ success: boolean; error?: string }> {
  // Get the offer
  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .eq("buyer_id", buyerId)
    .eq("status", "countered")
    .single();

  if (!offer) {
    return { success: false, error: "Counter-offer not found" };
  }

  const now = new Date().toISOString();

  if (action === "accept") {
    // Accept the counter-offer
    const paymentDeadline = calculatePaymentDeadline();

    // Atomic listing-status guard mirroring respondToOffer — only flip to
    // sold while the listing is still active, detect a lost race via zero
    // rows. H-MK1.
    const { data: soldRows, error: listingError } = await supabaseAdmin
      .from("auctions")
      .update({
        status: "sold",
        winner_id: buyerId,
        winning_bid: offer.counter_amount,
        payment_status: "pending",
        payment_deadline: paymentDeadline.toISOString(),
      })
      .eq("id", offer.listing_id)
      .eq("status", "active")
      .select("id");

    if (listingError) {
      return { success: false, error: listingError.message };
    }
    if (!soldRows || soldRows.length === 0) {
      return {
        success: false,
        error: "This listing is no longer available",
      };
    }

    await supabase
      .from("offers")
      .update({ status: "accepted", amount: offer.counter_amount, responded_at: now })
      .eq("id", offerId);

    // Auto-reject every other still-open offer on this listing. H-MK1.
    await supabaseAdmin
      .from("offers")
      .update({ status: "auto_rejected", updated_at: now })
      .eq("listing_id", offer.listing_id)
      .neq("id", offerId)
      .in("status", ["pending", "countered"]);

    // Notify seller
    await createNotification(offer.seller_id, "offer_accepted", offer.listing_id, offerId);

    // Send offer_accepted email to seller (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.seller_id),
        getProfileForEmail(buyerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_accepted",
          data: {
            buyerName: otherProfile?.displayName ?? "Buyer",
            sellerName: recipientProfile.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.counter_amount ?? offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_accepted (counter) failed:", err));
      }
    })();

    // Create feedback reminders for both parties (counter-offer acceptance is a "sale")
    await createFeedbackReminders("sale", offer.listing_id, buyerId, offer.seller_id);

    // Audit trail - fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId,
      actorProfileId: buyerId,
      eventType: "offer_accepted",
      eventData: {
        amount: offer.counter_amount,
        roundNumber: offer.round_number,
        acceptedBy: "buyer",
        counterOffer: true,
      },
    });

    return { success: true };
  }

  if (action === "reject") {
    await supabase
      .from("offers")
      .update({ status: "rejected", responded_at: now })
      .eq("id", offerId);

    // Notify seller
    await createNotification(offer.seller_id, "offer_rejected", offer.listing_id, offerId);

    // Send offer_rejected email to seller (fire and forget)
    (async () => {
      const [recipientProfile, otherProfile, comicData] = await Promise.all([
        getProfileForEmail(offer.seller_id),
        getProfileForEmail(buyerId),
        getListingComicData(offer.listing_id),
      ]);
      if (recipientProfile?.email && comicData) {
        sendNotificationEmail({
          to: recipientProfile.email,
          type: "offer_rejected",
          data: {
            buyerName: otherProfile?.displayName ?? "Buyer",
            sellerName: recipientProfile.displayName ?? "Seller",
            comicTitle: comicData.comicTitle,
            issueNumber: comicData.issueNumber,
            amount: offer.counter_amount ?? offer.amount,
            listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
          },
        }).catch((err) => console.error("[Email] offer_rejected (counter) failed:", err));
      }
    })();

    // Audit trail - fire-and-forget.
    void logAuctionAuditEvent({
      auctionId: offer.listing_id,
      offerId,
      actorProfileId: buyerId,
      eventType: "offer_rejected",
      eventData: {
        amount: offer.counter_amount ?? offer.amount,
        roundNumber: offer.round_number,
        rejectedBy: "buyer",
        counterOffer: true,
      },
    });

    return { success: true };
  }

  return { success: false, error: "Invalid action" };
}

/**
 * Get offers made by a buyer
 */
export async function getBuyerOffers(buyerId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("*, auctions(*)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map(transformOffer);
}
