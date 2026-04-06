import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Collectors Chest <notifications@collectors-chest.com>";

// Email templates for different notification types
type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

interface OfferEmailData {
  buyerName: string;
  sellerName: string;
  comicTitle: string;
  issueNumber: string;
  amount: number;
  counterAmount?: number;
  listingUrl: string;
}

interface ListingEmailData {
  sellerName: string;
  comicTitle: string;
  issueNumber: string;
  price: number;
  expiresIn?: string;
  listingUrl: string;
}

interface MessageEmailData {
  senderName: string;
  messagePreview: string;
  messagesUrl: string;
}

interface FeedbackEmailData {
  recipientName: string;
  otherPartyName: string;
  transactionType: "sale" | "auction" | "trade";
  comicTitle: string;
  issueNumber: string;
  feedbackUrl: string;
}

interface NewListingEmailData {
  sellerName: string;
  sellerUsername: string;
  comicTitle: string;
  price: number;
  listingUrl: string;
  coverImageUrl?: string;
}

interface WelcomeEmailData {
  collectionUrl: string;
}

interface TrialExpiringEmailData {
  trialEndsAt: string;
}

function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ============================================================================
// EMAIL SHARED HELPERS
// ============================================================================

export const EMAIL_SOUND_EFFECTS: Record<NotificationEmailType, string> = {
  welcome: "POW!",
  trial_expiring: "TICK TOCK!",
  offer_received: "KA-CHING!",
  offer_accepted: "WHAM!",
  offer_rejected: "HEY!",
  offer_countered: "ZAP!",
  offer_expired: "POOF!",
  listing_expiring: "HEADS UP!",
  listing_expired: "TIME'S UP!",
  message_received: "BAM!",
  feedback_reminder: "PSST!",
  new_listing_from_followed: "HOT!",
};

export function emailHeader(soundEffect: string): string {
  return `
    <div style="background: #0066FF; padding: 40px 24px 36px; text-align: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px); background-size: 12px 12px; pointer-events: none;"></div>
      <div style="position: relative; z-index: 1;">
        <div style="display: inline-block; background: #FFF200; color: #000; font-weight: 900; font-size: 14px; padding: 6px 16px; border: 3px solid #000; border-radius: 4px; transform: rotate(-2deg); margin-bottom: 12px; letter-spacing: 1px;">COLLECTORS CHEST</div>
      </div>
      <div style="position: relative; z-index: 1; margin: 16px auto; display: inline-block;">
        <div style="display: inline-block; background: #00CC66; color: #000; font-weight: 900; font-size: 28px; padding: 8px 80px; border: 4px solid #000; border-radius: 50%; transform: rotate(-3deg); box-shadow: 4px 4px 0 #000;">
          ${soundEffect}
        </div>
        <div style="width: 0; height: 0; margin-left: 55px; margin-top: -6px; border-left: 12px solid transparent; border-right: 5px solid transparent; border-top: 20px solid #000;"></div>
      </div>
    </div>
  `;
}

export function emailFooter(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  return `
    <div style="background: #f5f5f5; border-top: 2px solid #e5e5e5; padding: 24px 24px 28px; text-align: center;">
      <p style="font-size: 13px; color: #666; font-style: italic; margin: 0 0 8px;">Scan comics. Track value. Collect smarter.</p>
      <p style="font-size: 12px; color: #999; margin: 0 0 8px; line-height: 1.5;">Twisted Jester LLC · collectors-chest.com</p>
      <p style="font-size: 11px; color: #bbb; margin: 0; line-height: 1.5;"><a href="${appUrl}/privacy" style="color: #999; text-decoration: underline;">Privacy Policy</a> · <a href="${appUrl}/terms" style="color: #999; text-decoration: underline;">Terms of Service</a></p>
    </div>
  `;
}

// ============================================================================
// DATA HELPERS FOR EMAIL WIRING
// ============================================================================

export async function getProfileForEmail(
  userId: string
): Promise<{ email: string | null; displayName: string } | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name, username")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return {
    email: data.email ?? null,
    displayName: data.display_name || data.username || "Collector",
  };
}

export async function getListingComicData(
  listingId: string
): Promise<{ comicTitle: string; issueNumber: string; price: number } | null> {
  const { data } = await supabaseAdmin
    .from("auctions")
    .select("starting_price, comics!inner(title, issue_number)")
    .eq("id", listingId)
    .single();
  if (!data) return null;
  const comic = (data as any).comics;
  return {
    comicTitle: comic?.title || "Unknown",
    issueNumber: comic?.issue_number || "",
    price: data.starting_price || 0,
  };
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function offerReceivedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `New offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_received)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You've Received a New Offer!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${data.buyerName}</strong> has offered <strong>${formatPrice(data.amount)}</strong> for your listing:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${data.comicTitle} #${data.issueNumber}</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">You have 48 hours to respond to this offer.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW OFFER →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `You've received a new offer!\n\n${data.buyerName} has offered ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nYou have 48 hours to respond.\n\nView offer: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function offerAcceptedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} was accepted!`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_accepted)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Great News! Your Offer Was Accepted!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${data.sellerName}</strong> has accepted your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${data.comicTitle} #${data.issueNumber}</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">Please complete your payment within 48 hours to secure this purchase.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">COMPLETE PAYMENT →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Great news! Your offer was accepted!\n\n${data.sellerName} accepted your offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nComplete payment: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function offerRejectedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Update on your offer for ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_rejected)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Your Offer Was Declined</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Unfortunately, <strong>${data.sellerName}</strong> has declined your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${data.comicTitle} #${data.issueNumber}</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">You can submit a new offer or browse other listings in the shop.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your offer was declined.\n\n${data.sellerName} declined your offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nView listing: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function offerCounteredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Counter-offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_countered)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You've Received a Counter-Offer!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${data.sellerName}</strong> has countered your offer on:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${data.comicTitle} #${data.issueNumber}</p>
          <p style="font-size: 16px; color: #333; margin: 0 0 8px;">Your offer: ${formatPrice(data.amount)}</p>
          <p style="font-size: 16px; font-weight: bold; color: #000; margin: 0 0 12px;">Counter-offer: ${formatPrice(data.counterAmount || 0)}</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">You have 48 hours to respond to this counter-offer.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">RESPOND TO OFFER →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `You've received a counter-offer!\n\n${data.sellerName} countered your offer on ${data.comicTitle} #${data.issueNumber}.\n\nYour offer: ${formatPrice(data.amount)}\nCounter-offer: ${formatPrice(data.counterAmount || 0)}\n\nRespond: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function offerExpiredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Offer Expired</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your offer of <strong>${formatPrice(data.amount)}</strong> for the following item has expired:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${data.comicTitle} #${data.issueNumber}</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">The seller did not respond within 48 hours. You can submit a new offer if the listing is still active.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #6b7280; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your offer has expired.\n\nYour offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber} expired.\n\nView listing: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function listingExpiringTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} expires soon`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.listing_expiring)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Listing Expiring Soon</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your listing will expire ${data.expiresIn || "within 24 hours"}:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${data.comicTitle} #${data.issueNumber}</p>
          <p style="font-size: 16px; color: #333; margin: 0 0 12px;">Price: ${formatPrice(data.price)}</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">If you'd like to keep this listing active, you can relist it before it expires.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your listing is expiring soon!\n\n${data.comicTitle} #${data.issueNumber} (${formatPrice(data.price)}) will expire ${data.expiresIn || "within 24 hours"}.\n\nView listing: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function listingExpiredTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.listing_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Listing Expired</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your listing has expired and is no longer visible in the shop:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${data.comicTitle} #${data.issueNumber}</p>
          <p style="font-size: 16px; color: #333; margin: 0 0 12px;">Price: ${formatPrice(data.price)}</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">You can relist this item from your collection if you'd like to sell it.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/collection" style="display: inline-block; background: #6b7280; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW COLLECTION →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your listing has expired.\n\n${data.comicTitle} #${data.issueNumber} (${formatPrice(data.price)}) is no longer visible.\n\nView collection: ${process.env.NEXT_PUBLIC_APP_URL}/collection\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function messageReceivedTemplate(data: MessageEmailData): EmailTemplate {
  return {
    subject: `New message from ${data.senderName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.message_received)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You Have a New Message</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${data.senderName}</strong> sent you a message:</p>
          <blockquote style="border-left: 4px solid #0066FF; padding-left: 16px; margin: 16px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
            ${data.messagePreview}
          </blockquote>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.messagesUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW MESSAGE →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `New message from ${data.senderName}\n\n"${data.messagePreview}"\n\nView message: ${data.messagesUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function feedbackReminderTemplate(data: FeedbackEmailData): EmailTemplate {
  const transactionLabel = {
    sale: "purchase",
    auction: "auction",
    trade: "trade",
  }[data.transactionType];

  return {
    subject: `How was your ${transactionLabel}? Leave feedback for ${data.otherPartyName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.feedback_reminder)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Share Your Experience</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${data.recipientName},</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your ${transactionLabel} of <strong>${data.comicTitle} #${data.issueNumber}</strong> with <strong>${data.otherPartyName}</strong> was completed.</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">Your feedback helps build trust in our community. It only takes a moment!</p>
          <div style="text-align: center; margin: 0 0 24px;">
            <a href="${data.feedbackUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; font-size: 16px; padding: 14px 40px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">Leave Feedback</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">If you've already left feedback, you can ignore this email.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Hi ${data.recipientName},\n\nYour ${transactionLabel} of ${data.comicTitle} #${data.issueNumber} with ${data.otherPartyName} was completed.\n\nYour feedback helps build trust in our community.\n\nLeave feedback: ${data.feedbackUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function newListingFromFollowedTemplate(data: NewListingEmailData): EmailTemplate {
  const coverImageHtml = data.coverImageUrl
    ? `<img src="${data.coverImageUrl}" alt="${data.comicTitle}" style="max-width: 150px; border-radius: 8px; margin: 16px 0; border: 2px solid #000;" />`
    : "";

  return {
    subject: `New listing from @${data.sellerUsername} on Collectors Chest`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.new_listing_from_followed)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">New Listing Alert!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${data.sellerName}</strong> just listed a new comic:</p>
          ${coverImageHtml}
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${data.comicTitle}</p>
          <p style="font-size: 16px; color: #00CC66; font-weight: bold; margin: 0 0 24px;">${formatPrice(data.price)}</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">You're receiving this because you follow @${data.sellerUsername}.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `New Listing Alert!\n\n${data.sellerName} just listed a new comic:\n\n${data.comicTitle}\n${formatPrice(data.price)}\n\nView listing: ${data.listingUrl}\n\nYou're receiving this because you follow @${data.sellerUsername}.\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function welcomeTemplate(data: WelcomeEmailData): EmailTemplate {
  return {
    subject: "Welcome to Collectors Chest!",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.welcome)}
        <!-- Welcome title -->
        <div style="background: #0066FF; padding: 0 24px 28px; text-align: center;">
          <h1 style="position: relative; z-index: 1; color: #FFF200; font-size: 26px; font-weight: 900; margin: 0 0 4px; text-shadow: 2px 2px 0 #000; letter-spacing: 1px;">WELCOME TO THE CHEST!</h1>
          <p style="position: relative; z-index: 1; color: #ffffff; font-size: 15px; margin: 0; opacity: 0.9;">Your collection journey starts now.</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px;">
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">Hey there, Collector! You're officially part of the crew. Here's what you can do with Collectors Chest:</p>
          <!-- Feature: Scan -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;"><tr>
            <td width="50" style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="40" height="40" align="center" valign="middle" bgcolor="#ED1C24" style="border-radius: 20px; border: 2px solid #000; font-size: 18px; line-height: 40px; text-align: center;">📸</td></tr></table></td>
            <td style="vertical-align: top; padding-left: 10px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Scan Any Cover</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Snap a photo and our AI identifies your comic instantly.</div></td>
          </tr></table>
          <!-- Feature: Track -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;"><tr>
            <td width="50" style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="40" height="40" align="center" valign="middle" bgcolor="#0066FF" style="border-radius: 20px; border: 2px solid #000; font-size: 18px; line-height: 40px; text-align: center;">📊</td></tr></table></td>
            <td style="vertical-align: top; padding-left: 10px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Track Your Value</div><div style="font-size: 14px; color: #666; line-height: 1.4;">See real eBay pricing for every book in your collection.</div></td>
          </tr></table>
          <!-- Feature: Key Issues -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 16px;"><tr>
            <td width="50" style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="40" height="40" align="center" valign="middle" bgcolor="#FFF200" style="border-radius: 20px; border: 2px solid #000; font-size: 18px; line-height: 40px; text-align: center;">🔑</td></tr></table></td>
            <td style="vertical-align: top; padding-left: 10px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Discover Key Issues</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Find out if your books are first appearances, rare variants, or hidden gems.</div></td>
          </tr></table>
          <!-- Feature: Organize -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="50" style="vertical-align: middle;"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="40" height="40" align="center" valign="middle" bgcolor="#00CC66" style="border-radius: 20px; border: 2px solid #000; font-size: 18px; line-height: 40px; text-align: center;">📦</td></tr></table></td>
            <td style="vertical-align: top; padding-left: 10px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Organize Everything</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Custom lists, CSV import, stats, and more — your collection, your way.</div></td>
          </tr></table>
          <!-- Scan allowance -->
          <div style="background: #FFF8E7; border: 3px solid #000; border-radius: 8px; padding: 16px 20px; margin: 24px 0 28px; text-align: center;">
            <div style="font-weight: 900; font-size: 18px; color: #000; margin-bottom: 4px;">🎯 You get <span style="color: #ED1C24;">10 FREE scans</span> every month!</div>
            <div style="font-size: 13px; color: #666;">Start scanning your collection today.</div>
          </div>
          <!-- CTA -->
          <div style="text-align: center; margin: 0 0 32px;">
            <a href="${data.collectionUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; font-size: 18px; padding: 16px 48px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">START SCANNING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Welcome to Collectors Chest!\n\nHey there, Collector! You're officially part of the crew.\n\nHere's what you can do:\n\n📸 Scan Any Cover — Snap a photo and our AI identifies your comic instantly.\n📊 Track Your Value — See real eBay pricing for every book in your collection.\n🔑 Discover Key Issues — Find out if your books are first appearances, rare variants, or hidden gems.\n📦 Organize Everything — Custom lists, CSV import, stats, and more.\n\n🎯 You get 10 free scans every month!\n\nStart scanning: ${data.collectionUrl}\n\nScan comics. Track value. Collect smarter.\n\nTwisted Jester LLC · collectors-chest.com`,
  };
}

function trialExpiringTemplate(data: TrialExpiringEmailData): EmailTemplate {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  const choosePlanUrl = `${appUrl}/choose-plan`;

  return {
    subject: "Your Collectors Chest trial ends in 3 days",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.trial_expiring)}
        <!-- Title -->
        <div style="background: #0066FF; padding: 0 24px 28px; text-align: center;">
          <h1 style="position: relative; z-index: 1; color: #FFF200; font-size: 24px; font-weight: 900; margin: 0 0 4px; text-shadow: 2px 2px 0 #000; letter-spacing: 1px;">YOUR TRIAL ENDS SOON!</h1>
          <p style="position: relative; z-index: 1; color: #ffffff; font-size: 15px; margin: 0; opacity: 0.9;">Premium access expires on ${data.trialEndsAt}</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px;">
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">Hey Collector! Your 30-day free trial ends on <strong>${data.trialEndsAt}</strong>. Don't lose access to the premium features you've been using.</p>
          <!-- What you'll lose box -->
          <div style="background: #FFF8E7; border: 3px solid #000; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
            <div style="font-weight: 900; font-size: 16px; color: #000; margin-bottom: 12px;">What you'll lose when your trial ends:</div>
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ Unlimited scans</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ Key Hunt — find valuable issues in your collection</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ CSV export</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ Advanced collection stats &amp; insights</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ Priority scan queue</td></tr>
            </table>
          </div>
          <!-- Pricing -->
          <div style="text-align: center; margin: 0 0 8px;">
            <div style="font-weight: 900; font-size: 20px; color: #000;">$4.99/month — less than a single comic</div>
          </div>
          <div style="text-align: center; margin: 0 0 28px;">
            <div style="font-size: 14px; color: #00CC66; font-weight: 700;">Save 17% with the annual plan</div>
          </div>
          <!-- CTA -->
          <div style="text-align: center; margin: 0 0 32px;">
            <a href="${choosePlanUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; font-size: 18px; padding: 16px 48px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">STAY PREMIUM →</a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">After your trial ends you'll drop to 10 free scans/month. Upgrade anytime to restore full access.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your Collectors Chest trial ends in 3 days\n\nYour premium trial expires on ${data.trialEndsAt}.\n\nWhat you'll lose:\n- Unlimited scans\n- Key Hunt\n- CSV export\n- Advanced collection stats & insights\n- Priority scan queue\n\n$4.99/month — less than a single comic\nSave 17% with the annual plan\n\nSTAY PREMIUM: ${choosePlanUrl}\n\nScan comics. Track value. Collect smarter.\n\nTwisted Jester LLC · collectors-chest.com`,
  };
}

// ============================================================================
// SEND EMAIL FUNCTION
// ============================================================================

export type NotificationEmailType =
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_countered"
  | "offer_expired"
  | "listing_expiring"
  | "listing_expired"
  | "message_received"
  | "feedback_reminder"
  | "new_listing_from_followed"
  | "welcome"
  | "trial_expiring";

interface SendNotificationEmailParams {
  to: string;
  type: NotificationEmailType;
  data:
    | OfferEmailData
    | ListingEmailData
    | MessageEmailData
    | FeedbackEmailData
    | NewListingEmailData
    | WelcomeEmailData
    | TrialExpiringEmailData;
}

export async function sendNotificationEmail({
  to,
  type,
  data,
}: SendNotificationEmailParams): Promise<{ success: boolean; error?: string }> {
  // Skip if no API key configured
  if (!process.env.RESEND_API_KEY) {
    return { success: true };
  }

  let template: EmailTemplate;

  switch (type) {
    case "offer_received":
      template = offerReceivedTemplate(data as OfferEmailData);
      break;
    case "offer_accepted":
      template = offerAcceptedTemplate(data as OfferEmailData);
      break;
    case "offer_rejected":
      template = offerRejectedTemplate(data as OfferEmailData);
      break;
    case "offer_countered":
      template = offerCounteredTemplate(data as OfferEmailData);
      break;
    case "offer_expired":
      template = offerExpiredTemplate(data as OfferEmailData);
      break;
    case "listing_expiring":
      template = listingExpiringTemplate(data as ListingEmailData);
      break;
    case "listing_expired":
      template = listingExpiredTemplate(data as ListingEmailData);
      break;
    case "message_received":
      template = messageReceivedTemplate(data as MessageEmailData);
      break;
    case "feedback_reminder":
      template = feedbackReminderTemplate(data as FeedbackEmailData);
      break;
    case "new_listing_from_followed":
      template = newListingFromFollowedTemplate(data as NewListingEmailData);
      break;
    case "welcome":
      template = welcomeTemplate(data as WelcomeEmailData);
      break;
    case "trial_expiring":
      template = trialExpiringTemplate(data as TrialExpiringEmailData);
      break;
    default:
      return { success: false, error: `Unknown email type: ${type}` };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (error) {
      console.error(`[Email] Failed to send ${type} to ${to}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error(`[Email] Error sending ${type} to ${to}:`, err);
    return { success: false, error: String(err) };
  }
}

export type { FeedbackEmailData, NewListingEmailData, WelcomeEmailData, TrialExpiringEmailData };
