import { Resend } from "resend";

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

function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function offerReceivedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `New offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <h2>You've received a new offer!</h2>
      <p><strong>${data.buyerName}</strong> has offered <strong>${formatPrice(data.amount)}</strong> for your listing:</p>
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
      <p>You have 48 hours to respond to this offer.</p>
      <p><a href="${data.listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 8px;">View Offer</a></p>
    `,
    text: `You've received a new offer!\n\n${data.buyerName} has offered ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nYou have 48 hours to respond.\n\nView offer: ${data.listingUrl}`,
  };
}

function offerAcceptedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} was accepted!`,
    html: `
      <h2>Great news! Your offer was accepted!</h2>
      <p><strong>${data.sellerName}</strong> has accepted your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
      <p>Please complete your payment within 48 hours to secure this purchase.</p>
      <p><a href="${data.listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 8px;">Complete Payment</a></p>
    `,
    text: `Great news! Your offer was accepted!\n\n${data.sellerName} accepted your offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nComplete payment: ${data.listingUrl}`,
  };
}

function offerRejectedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Update on your offer for ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <h2>Your offer was declined</h2>
      <p>Unfortunately, <strong>${data.sellerName}</strong> has declined your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
      <p>You can submit a new offer or browse other listings in the shop.</p>
      <p><a href="${data.listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px;">View Listing</a></p>
    `,
    text: `Your offer was declined.\n\n${data.sellerName} declined your offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nView listing: ${data.listingUrl}`,
  };
}

function offerCounteredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Counter-offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <h2>You've received a counter-offer!</h2>
      <p><strong>${data.sellerName}</strong> has countered your offer on:</p>
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
      <p>Your offer: ${formatPrice(data.amount)}</p>
      <p><strong>Counter-offer: ${formatPrice(data.counterAmount || 0)}</strong></p>
      <p>You have 48 hours to respond to this counter-offer.</p>
      <p><a href="${data.listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 8px;">Respond to Offer</a></p>
    `,
    text: `You've received a counter-offer!\n\n${data.sellerName} countered your offer on ${data.comicTitle} #${data.issueNumber}.\n\nYour offer: ${formatPrice(data.amount)}\nCounter-offer: ${formatPrice(data.counterAmount || 0)}\n\nRespond: ${data.listingUrl}`,
  };
}

function offerExpiredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <h2>Offer Expired</h2>
      <p>Your offer of <strong>${formatPrice(data.amount)}</strong> for the following item has expired:</p>
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
      <p>The seller did not respond within 48 hours. You can submit a new offer if the listing is still active.</p>
      <p><a href="${data.listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6b7280; color: white; text-decoration: none; border-radius: 8px;">View Listing</a></p>
    `,
    text: `Your offer has expired.\n\nYour offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber} expired.\n\nView listing: ${data.listingUrl}`,
  };
}

function listingExpiringTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} expires soon`,
    html: `
      <h2>Listing Expiring Soon</h2>
      <p>Your listing will expire ${data.expiresIn || "within 24 hours"}:</p>
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
      <p>Price: ${formatPrice(data.price)}</p>
      <p>If you'd like to keep this listing active, you can relist it before it expires.</p>
      <p><a href="${data.listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 8px;">View Listing</a></p>
    `,
    text: `Your listing is expiring soon!\n\n${data.comicTitle} #${data.issueNumber} (${formatPrice(data.price)}) will expire ${data.expiresIn || "within 24 hours"}.\n\nView listing: ${data.listingUrl}`,
  };
}

function listingExpiredTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <h2>Listing Expired</h2>
      <p>Your listing has expired and is no longer visible in the shop:</p>
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
      <p>Price: ${formatPrice(data.price)}</p>
      <p>You can relist this item from your collection if you'd like to sell it.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/collection" style="display: inline-block; padding: 12px 24px; background-color: #6b7280; color: white; text-decoration: none; border-radius: 8px;">View Collection</a></p>
    `,
    text: `Your listing has expired.\n\n${data.comicTitle} #${data.issueNumber} (${formatPrice(data.price)}) is no longer visible.\n\nView collection: ${process.env.NEXT_PUBLIC_APP_URL}/collection`,
  };
}

function messageReceivedTemplate(data: MessageEmailData): EmailTemplate {
  return {
    subject: `New message from ${data.senderName}`,
    html: `
      <h2>You have a new message</h2>
      <p><strong>${data.senderName}</strong> sent you a message:</p>
      <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 16px 0; color: #4b5563;">
        ${data.messagePreview}
      </blockquote>
      <p><a href="${data.messagesUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 8px;">View Message</a></p>
    `,
    text: `New message from ${data.senderName}\n\n"${data.messagePreview}"\n\nView message: ${data.messagesUrl}`,
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
      <h2>Share Your Experience</h2>
      <p>Hi ${data.recipientName},</p>
      <p>Your ${transactionLabel} of <strong>${data.comicTitle} #${data.issueNumber}</strong> with <strong>${data.otherPartyName}</strong> was completed.</p>
      <p>Your feedback helps build trust in our community. It only takes a moment!</p>
      <p><a href="${data.feedbackUrl}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 8px;">Leave Feedback</a></p>
      <p style="color: #6b7280; font-size: 14px;">If you've already left feedback, you can ignore this email.</p>
    `,
    text: `Hi ${data.recipientName},\n\nYour ${transactionLabel} of ${data.comicTitle} #${data.issueNumber} with ${data.otherPartyName} was completed.\n\nYour feedback helps build trust in our community.\n\nLeave feedback: ${data.feedbackUrl}`,
  };
}

function newListingFromFollowedTemplate(data: NewListingEmailData): EmailTemplate {
  const coverImageHtml = data.coverImageUrl
    ? `<img src="${data.coverImageUrl}" alt="${data.comicTitle}" style="max-width: 150px; border-radius: 8px; margin: 16px 0;" />`
    : "";

  return {
    subject: `New listing from @${data.sellerUsername} on Collectors Chest`,
    html: `
      <h2>New Listing Alert!</h2>
      <p><strong>${data.sellerName}</strong> just listed a new comic:</p>
      ${coverImageHtml}
      <p style="font-size: 18px; font-weight: bold;">${data.comicTitle}</p>
      <p style="font-size: 16px; color: #16a34a; font-weight: bold;">${formatPrice(data.price)}</p>
      <p><a href="${data.listingUrl}" style="display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 8px;">View Listing</a></p>
      <p style="color: #6b7280; font-size: 14px;">You're receiving this because you follow @${data.sellerUsername}.</p>
    `,
    text: `New Listing Alert!\n\n${data.sellerName} just listed a new comic:\n\n${data.comicTitle}\n${formatPrice(data.price)}\n\nView listing: ${data.listingUrl}\n\nYou're receiving this because you follow @${data.sellerUsername}.`,
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
  | "new_listing_from_followed";

interface SendNotificationEmailParams {
  to: string;
  type: NotificationEmailType;
  data:
    | OfferEmailData
    | ListingEmailData
    | MessageEmailData
    | FeedbackEmailData
    | NewListingEmailData;
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

export type { FeedbackEmailData, NewListingEmailData };
