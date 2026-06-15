import { FREE_MONTHLY_SCAN_LIMIT } from "@/lib/subscription";
import { EMAIL_SOUND_EFFECTS, GUEST_BONUS_SCAN_COUNT } from "./constants";
import {
  emailFooter,
  emailHeader,
  escapeHtml,
  formatPrice,
} from "./helpers";
import type {
  AuctionEndEmailData,
  AuctionEndingSoonEmailData,
  BidActivityEmailData,
  BonusScanGrantedEmailData,
  BonusScanVerifyEmailData,
  EmailTemplate,
  FeedbackEmailData,
  ListingEmailData,
  MarketplaceTransactionEmailData,
  MessageEmailData,
  NewListingEmailData,
  OfferEmailData,
  PaymentExpiredBuyerEmailData,
  PaymentExpiredSellerEmailData,
  PaymentMissedFlaggedEmailData,
  PaymentMissedWarningEmailData,
  PaymentReminderEmailData,
  SecondChanceRunnerUpEmailData,
  SecondChanceSellerAvailableEmailData,
  SecondChanceSellerResultEmailData,
  SubscriptionPaymentFailedEmailData,
  TrialExpiringEmailData,
  WelcomeEmailData,
} from "./types";

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export function offerReceivedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `New offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_received)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You've Received a New Offer!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${escapeHtml(data.buyerName)}</strong> has offered <strong>${formatPrice(data.amount)}</strong> for your listing:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
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

export function offerAcceptedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} was accepted!`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_accepted)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Great News! Your Offer Was Accepted!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${escapeHtml(data.sellerName)}</strong> has accepted your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
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

export function offerRejectedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Update on your offer for ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_rejected)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Your Offer Was Declined</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Unfortunately, <strong>${escapeHtml(data.sellerName)}</strong> has declined your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
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

export function offerCounteredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Counter-offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_countered)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You've Received a Counter-Offer!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${escapeHtml(data.sellerName)}</strong> has countered your offer on:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
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

export function offerExpiredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Offer Expired</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your offer of <strong>${formatPrice(data.amount)}</strong> for the following item has expired:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
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

export function listingExpiringTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} expires soon`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.listing_expiring)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Listing Expiring Soon</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your listing will expire ${data.expiresIn || "within 24 hours"}:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
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

export function listingExpiredTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.listing_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Listing Expired</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your listing has expired and is no longer visible in the shop:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
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

export function messageReceivedTemplate(data: MessageEmailData): EmailTemplate {
  return {
    subject: `New message from ${data.senderName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.message_received)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You Have a New Message</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${escapeHtml(data.senderName)}</strong> sent you a message:</p>
          <blockquote style="border-left: 4px solid #0066FF; padding-left: 16px; margin: 16px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
            ${escapeHtml(data.messagePreview)}
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

export function feedbackReminderTemplate(data: FeedbackEmailData): EmailTemplate {
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
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName)},</p>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your ${transactionLabel} of <strong>${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</strong> with <strong>${escapeHtml(data.otherPartyName)}</strong> was completed.</p>
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

export function newListingFromFollowedTemplate(data: NewListingEmailData): EmailTemplate {
  const coverImageHtml = data.coverImageUrl
    ? `<img src="${escapeHtml(data.coverImageUrl)}" alt="${escapeHtml(data.comicTitle)}" style="max-width: 150px; border-radius: 8px; margin: 16px 0; border: 2px solid #000;" />`
    : "";

  return {
    subject: `New listing from @${data.sellerUsername} on Collectors Chest`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.new_listing_from_followed)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">New Listing Alert!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;"><strong>${escapeHtml(data.sellerName)}</strong> just listed a new comic:</p>
          ${coverImageHtml}
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)}</p>
          <p style="font-size: 16px; color: #00CC66; font-weight: bold; margin: 0 0 24px;">${formatPrice(data.price)}</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">You're receiving this because you follow @${escapeHtml(data.sellerUsername)}.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `New Listing Alert!\n\n${data.sellerName} just listed a new comic:\n\n${data.comicTitle}\n${formatPrice(data.price)}\n\nView listing: ${data.listingUrl}\n\nYou're receiving this because you follow @${data.sellerUsername}.\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function welcomeTemplate(data: WelcomeEmailData): EmailTemplate {
  return {
    subject: "Welcome to Collectors Chest!",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.welcome)}
        <!-- Welcome title -->
        <div style="background: #0066FF; padding: 0 24px 28px; text-align: center; position: relative;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px); background-size: 12px 12px; pointer-events: none;"></div>
          <div style="position: relative; z-index: 1; display: inline-block; background: #FFF200; color: #000; font-weight: 900; font-size: 18px; padding: 8px 20px; border: 3px solid #000; border-radius: 4px; margin-bottom: 10px; letter-spacing: 1px;">WELCOME TO THE CHEST!</div>
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
            <td style="vertical-align: top; padding-left: 10px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Organize Everything</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Custom lists, CSV import, stats, and more, your collection, your way.</div></td>
          </tr></table>
          <!-- Scan allowance -->
          <div style="background: #FFF8E7; border: 3px solid #000; border-radius: 8px; padding: 16px 20px; margin: 24px 0 28px; text-align: center;">
            <div style="font-weight: 900; font-size: 18px; color: #000; margin-bottom: 4px;">🎯 You get <span style="color: #ED1C24;">${FREE_MONTHLY_SCAN_LIMIT} FREE scans</span> every month!</div>
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
    text: `Welcome to Collectors Chest!\n\nHey there, Collector! You're officially part of the crew.\n\nHere's what you can do:\n\n📸 Scan Any Cover: Snap a photo and our AI identifies your comic instantly.\n📊 Track Your Value: See real eBay pricing for every book in your collection.\n🔑 Discover Key Issues: Find out if your books are first appearances, rare variants, or hidden gems.\n📦 Organize Everything: Custom lists, CSV import, stats, and more.\n\n🎯 You get ${FREE_MONTHLY_SCAN_LIMIT} free scans every month!\n\nStart scanning: ${data.collectionUrl}\n\nScan comics. Track value. Collect smarter.\n\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function trialExpiringTemplate(data: TrialExpiringEmailData): EmailTemplate {
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
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ Key Hunt: find valuable issues in your collection</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ CSV export</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ Advanced collection stats &amp; insights</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #333;">❌ Priority scan queue</td></tr>
            </table>
          </div>
          <!-- Pricing -->
          <div style="text-align: center; margin: 0 0 8px;">
            <div style="font-weight: 900; font-size: 20px; color: #000;">$4.99/month, less than a single comic</div>
          </div>
          <div style="text-align: center; margin: 0 0 28px;">
            <div style="font-size: 14px; color: #00CC66; font-weight: 700;">Save 17% with the annual plan</div>
          </div>
          <!-- CTA -->
          <div style="text-align: center; margin: 0 0 32px;">
            <a href="${choosePlanUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; font-size: 18px; padding: 16px 48px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">STAY PREMIUM →</a>
          </div>
          <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0;">After your trial ends you'll drop to ${FREE_MONTHLY_SCAN_LIMIT} free scans/month. Upgrade anytime to restore full access.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your Collectors Chest trial ends in 3 days\n\nYour premium trial expires on ${data.trialEndsAt}.\n\nWhat you'll lose:\n- Unlimited scans\n- Key Hunt\n- CSV export\n- Advanced collection stats & insights\n- Priority scan queue\n\n$4.99/month, less than a single comic\nSave 17% with the annual plan\n\nSTAY PREMIUM: ${choosePlanUrl}\n\nScan comics. Track value. Collect smarter.\n\nTwisted Jester LLC · collectors-chest.com`,
  };
}

// ============================================================================
// MARKETPLACE TRANSACTION TEMPLATES
// ============================================================================

export function purchaseConfirmationTemplate(data: MarketplaceTransactionEmailData): EmailTemplate {
  const variantSuffix = data.variant ? ` (${escapeHtml(data.variant)})` : "";
  const variantSuffixText = data.variant ? ` (${data.variant})` : "";
  const shippingLine = data.shippingCost && data.shippingCost > 0
    ? `<tr><td style="padding: 4px 0; color: #555;">Shipping</td><td style="padding: 4px 0; text-align: right; color: #555;">${formatPrice(data.shippingCost)}</td></tr>`
    : "";
  const flowLabel = data.transactionType === "buy_now" ? "Buy Now purchase" : "Auction win";
  return {
    subject: `Purchase confirmation: ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.purchase_confirmation)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Your purchase is confirmed!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">Hi ${escapeHtml(data.buyerName || "there")}, thanks for your ${flowLabel} from <strong>${escapeHtml(data.sellerName)}</strong>. The comic will be added to your collection once the seller marks it as shipped.</p>
          <div style="background: #F5F9FF; border: 2px solid #0066FF; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
            <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}${variantSuffix}</p>
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 14px;">
              <tr><td style="padding: 4px 0; color: #555;">Item</td><td style="padding: 4px 0; text-align: right; color: #555;">${formatPrice(data.salePrice)}</td></tr>
              ${shippingLine}
              <tr><td style="padding: 8px 0 4px; border-top: 1px solid #ddd; font-weight: bold; color: #000;">Total paid</td><td style="padding: 8px 0 4px; border-top: 1px solid #ddd; text-align: right; font-weight: bold; color: #000;">${formatPrice(data.total)}</td></tr>
            </table>
          </div>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">Your seller will arrange shipping and send you tracking details once the comic is on its way.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW PURCHASE →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Purchase confirmed!\n\nHi ${data.buyerName || "there"}, thanks for your ${flowLabel} from ${data.sellerName}.\n\n${data.comicTitle} #${data.issueNumber}${variantSuffixText}\nItem: ${formatPrice(data.salePrice)}${data.shippingCost && data.shippingCost > 0 ? `\nShipping: ${formatPrice(data.shippingCost)}` : ""}\nTotal paid: ${formatPrice(data.total)}\n\nYour seller will arrange shipping and send tracking details.\n\nView purchase: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function itemSoldTemplate(data: MarketplaceTransactionEmailData): EmailTemplate {
  const variantSuffix = data.variant ? ` (${escapeHtml(data.variant)})` : "";
  const variantSuffixText = data.variant ? ` (${data.variant})` : "";
  const flowLabel = data.transactionType === "buy_now" ? "Buy Now purchase" : "auction win";
  return {
    subject: `Item sold: ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.item_sold)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Your item sold!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 16px;">Hi ${escapeHtml(data.sellerName || "there")}, <strong>${escapeHtml(data.buyerName)}</strong> completed a ${flowLabel} and payment has been captured. Time to ship!</p>
          <div style="background: #EFFAF0; border: 2px solid #00CC66; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
            <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 12px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}${variantSuffix}</p>
            <p style="font-size: 14px; color: #333; margin: 0 0 4px;">Sale price: <strong>${formatPrice(data.salePrice)}</strong></p>
            <p style="font-size: 14px; color: #333; margin: 0;">Total received (pre-fees): <strong>${formatPrice(data.total)}</strong></p>
          </div>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">Funds are on their way to your Stripe account. Please ship the item promptly and add tracking once you have it so the buyer stays informed.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #00CC66; color: #000000; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW SALE →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your item sold!\n\nHi ${data.sellerName || "there"}, ${data.buyerName} completed a ${flowLabel} and payment has been captured.\n\n${data.comicTitle} #${data.issueNumber}${variantSuffixText}\nSale price: ${formatPrice(data.salePrice)}\nTotal received (pre-fees): ${formatPrice(data.total)}\n\nFunds are on their way to your Stripe account. Ship the item promptly and add tracking once you have it.\n\nView sale: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

// ============================================================================
// BID / AUCTION ACTIVITY TEMPLATES
// ============================================================================

export function outbidTemplate(data: BidActivityEmailData): EmailTemplate {
  const endsLine = data.endsIn ? `<p style="font-size: 14px; color: #b45309; margin: 0 0 12px;">Auction ends in <strong>${data.endsIn}</strong>.</p>` : "";
  const maxBidHtmlLine =
    typeof data.yourMaxBid === "number"
      ? `<p style="font-size: 15px; color: #555; margin: 0 0 8px;">Your max bid: <strong>${formatPrice(data.yourMaxBid)}</strong></p>`
      : "";
  const maxBidTextLine =
    typeof data.yourMaxBid === "number" ? `Your max bid: ${formatPrice(data.yourMaxBid)}\n` : "";
  return {
    subject: `You've been outbid on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.outbid)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You've been outbid</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, another bidder has topped your bid on <strong>${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</strong>.</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 8px;">Current bid: <strong>${formatPrice(data.currentBid)}</strong></p>
          ${maxBidHtmlLine}
          ${endsLine}
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">PLACE A NEW BID →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `You've been outbid!\n\nAnother bidder topped your bid on ${data.comicTitle} #${data.issueNumber}.\nCurrent bid: ${formatPrice(data.currentBid)}\n${maxBidTextLine}${data.endsIn ? `Auction ends in ${data.endsIn}\n` : ""}\nPlace a new bid: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function auctionWonTemplate(data: AuctionEndEmailData): EmailTemplate {
  const deadlineLine = data.paymentDeadline
    ? `<p style="font-size: 14px; color: #b45309; margin: 0 0 16px;">Complete payment by <strong>${data.paymentDeadline}</strong> to secure your win.</p>`
    : "";
  const payUrl = data.transactionsUrl || data.listingUrl;
  return {
    subject: `Congratulations, you won ${data.comicTitle} #${data.issueNumber}!`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.auction_won)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Congratulations, you won!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, your bid on <strong>${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</strong> was the winner.</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Final price: <strong>${formatPrice(data.finalPrice)}</strong></p>
          ${deadlineLine}
          <div style="text-align: center; margin: 24px 0;">
            <a href="${payUrl}" style="display: inline-block; background: #00CC66; color: #000000; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">COMPLETE PAYMENT →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Congratulations, you won!\n\nYou won the auction for ${data.comicTitle} #${data.issueNumber}.\nFinal price: ${formatPrice(data.finalPrice)}\n${data.paymentDeadline ? `Complete payment by ${data.paymentDeadline} to secure your win.\n` : ""}\nComplete payment: ${payUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function auctionSoldTemplate(data: AuctionEndEmailData): EmailTemplate {
  return {
    subject: `Your auction ended: ${data.comicTitle} #${data.issueNumber} sold for ${formatPrice(data.finalPrice)}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.auction_sold)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Your auction sold!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, your auction for <strong>${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</strong> closed with a winning bidder.</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Final price: <strong>${formatPrice(data.finalPrice)}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">We'll notify you again when the buyer completes payment. At that point, please ship the item promptly.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW SALE →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your auction sold!\n\n${data.comicTitle} #${data.issueNumber} closed with a winning bidder.\nFinal price: ${formatPrice(data.finalPrice)}\n\nWe'll notify you again when the buyer completes payment. Ship the item promptly after that.\n\nView sale: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function paymentReminderTemplate(data: PaymentReminderEmailData): EmailTemplate {
  const hoursLabel =
    data.hoursRemaining <= 1
      ? "less than 1 hour"
      : `${data.hoursRemaining} hours`;
  return {
    subject: `Payment due soon: ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.payment_reminder)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Payment Due Soon</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, you have <strong>${hoursLabel}</strong> left to complete payment for your winning bid:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Final price: <strong>${formatPrice(data.finalPrice)}</strong></p>
          <p style="font-size: 14px; color: #b45309; margin: 0 0 16px;">Deadline: <strong>${data.paymentDeadline}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">If payment isn't received before the deadline, the auction will be cancelled and the seller may re-list the comic.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.transactionsUrl}" style="display: inline-block; background: #00CC66; color: #000000; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">COMPLETE PAYMENT →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Payment due soon!\n\nYou have ${hoursLabel} left to complete payment for ${data.comicTitle} #${data.issueNumber}.\nFinal price: ${formatPrice(data.finalPrice)}\nDeadline: ${data.paymentDeadline}\n\nIf payment isn't received before the deadline, the auction will be cancelled.\n\nComplete payment: ${data.transactionsUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function auctionPaymentExpiredBuyerTemplate(
  data: PaymentExpiredBuyerEmailData
): EmailTemplate {
  return {
    subject: `Payment window closed: ${data.comicTitle} #${data.issueNumber} auction cancelled`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.auction_payment_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Payment Window Closed</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, your 48-hour payment window for this auction has passed:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Final bid: <strong>${formatPrice(data.finalPrice)}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">The auction has been cancelled. <strong>You will not be charged.</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">Keep an eye on the shop for similar books. New listings go up every day.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">BROWSE SHOP →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Payment window closed.\n\nYour 48-hour payment window for ${data.comicTitle} #${data.issueNumber} (${formatPrice(data.finalPrice)}) has passed and the auction has been cancelled. You will not be charged.\n\nBrowse more listings: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function auctionPaymentExpiredSellerTemplate(
  data: PaymentExpiredSellerEmailData
): EmailTemplate {
  return {
    subject: `Buyer did not pay: ${data.comicTitle} #${data.issueNumber} cancelled, relist ready`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.auction_payment_expired_seller)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Buyer Did Not Pay In Time</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, the winning bidder didn't complete payment within the 48-hour window:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Final bid: <strong>${formatPrice(data.finalPrice)}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">The auction has been cancelled. The comic is back in your collection and ready to be re-listed.</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">Tip: enabling Buy It Now on a re-list can speed up future sales by letting committed buyers skip the auction wait.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">RE-LIST COMIC →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Buyer did not pay.\n\nThe winning bidder for ${data.comicTitle} #${data.issueNumber} (${formatPrice(data.finalPrice)}) did not pay within 48 hours. The auction has been cancelled and the comic is back in your collection.\n\nConsider enabling Buy It Now on the re-list for faster sales.\n\nRe-list: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

// ============================================================================
// Second Chance Offer + Strike System
// ----------------------------------------------------------------------------
// Added April 23, 2026. All new templates for the Second Chance Offer
// flow and the Payment-Miss Strike system live in this section. The template
// resolver switch dispatches here; nothing else should
// need to change to wire a new template up.
// ============================================================================

export function secondChanceAvailableTemplate(
  data: SecondChanceSellerAvailableEmailData
): EmailTemplate {
  return {
    subject: `Buyer didn't pay: offer to runner-up for ${formatPrice(data.runnerUpLastBid)}?`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.second_chance_available)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Second Chance Available</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, the winning bidder didn't pay in time, but there was a runner-up on your auction:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Runner-up's last bid: <strong>${formatPrice(data.runnerUpLastBid)}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">You can offer the comic to them at their last bid price. They'll have 48 hours to accept or decline.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.offerUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">OFFER TO RUNNER-UP →</a>
          </div>
          <p style="font-size: 13px; color: #999; line-height: 1.6; margin: 24px 0 0;">No pressure: if you'd rather re-list, just ignore this email.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Second chance available.\n\nThe winner didn't pay for ${data.comicTitle} #${data.issueNumber}, but there was a runner-up at ${formatPrice(data.runnerUpLastBid)}. You can offer the comic to them at that price. They'll have 48 hours to respond.\n\nOffer to runner-up: ${data.offerUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function secondChanceOfferedTemplate(
  data: SecondChanceRunnerUpEmailData
): EmailTemplate {
  return {
    subject: `Good news: ${data.comicTitle} #${data.issueNumber} is yours for ${formatPrice(data.offerPrice)}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.second_chance_offered)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You Got a Second Chance!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, the original winner didn't pay, and the seller has offered this comic to you at your last bid:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Your price: <strong>${formatPrice(data.offerPrice)}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">You have until <strong>${data.expiresAt}</strong> (48 hours) to accept or decline.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.responseUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">REVIEW OFFER →</a>
          </div>
          <p style="font-size: 13px; color: #999; line-height: 1.6; margin: 24px 0 0;">If you don't respond in 48 hours the offer expires and the seller can re-list.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Second chance offer!\n\nThe seller has offered ${data.comicTitle} #${data.issueNumber} to you at your last bid of ${formatPrice(data.offerPrice)}. You have until ${data.expiresAt} (48 hours) to accept or decline.\n\nReview the offer: ${data.responseUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function secondChanceAcceptedTemplate(
  data: SecondChanceSellerResultEmailData
): EmailTemplate {
  return {
    subject: `Runner-up accepted your second-chance offer: ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.second_chance_accepted)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Runner-Up Accepted!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, the runner-up accepted your second-chance offer:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Sale price: <strong>${formatPrice(data.offerPrice)}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">Payment is pending. They have 48 hours to complete checkout.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW SALE →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Runner-up accepted!\n\n${data.comicTitle} #${data.issueNumber} has been sold to the runner-up for ${formatPrice(data.offerPrice)}. They have 48 hours to complete payment.\n\n${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function secondChanceDeclinedTemplate(
  data: SecondChanceSellerResultEmailData
): EmailTemplate {
  return {
    subject: `Runner-up declined: ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.second_chance_declined)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Runner-Up Declined</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, the runner-up declined your second-chance offer on:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">The comic is back in your collection. You can re-list whenever you're ready.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">RE-LIST COMIC →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Runner-up declined.\n\nThe runner-up declined your second-chance offer on ${data.comicTitle} #${data.issueNumber}. The comic is back in your collection and ready to be re-listed.\n\nRe-list: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function secondChanceExpiredTemplate(
  data: SecondChanceSellerResultEmailData
): EmailTemplate {
  return {
    subject: `Second-chance offer expired: ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.second_chance_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Second-Chance Offer Expired</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, the runner-up did not respond within 48 hours for:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">No worries: the comic is back in your collection and ready to be re-listed.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">RE-LIST COMIC →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Second-chance offer expired.\n\nThe runner-up didn't respond within 48 hours for ${data.comicTitle} #${data.issueNumber}. The comic is back in your collection.\n\nRe-list: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function paymentMissedWarningTemplate(
  data: PaymentMissedWarningEmailData
): EmailTemplate {
  return {
    subject: "Please pay on time next time",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.payment_missed_warning)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Payment Deadline Missed</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, we noticed you missed the 48-hour payment window for:</p>
          <p style="font-size: 18px; font-weight: bold; color: #000; margin: 0 0 8px;">${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)}</p>
          <p style="font-size: 15px; color: #555; margin: 0 0 12px;">Final bid: <strong>${formatPrice(data.finalPrice)}</strong></p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">That auction was cancelled and <strong>you were not charged</strong>. This is a friendly heads-up, not a strike.</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">If this happens again within 90 days, we may temporarily restrict new bids on your account so other collectors don't miss out on listings you can't complete.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.shopUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">BROWSE SHOP →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Payment deadline missed.\n\nYou missed the 48-hour payment window for ${data.comicTitle} #${data.issueNumber} (${formatPrice(data.finalPrice)}). That auction was cancelled and you were not charged. This is a friendly warning.\n\nIf this happens again within 90 days, new bids on your account may be temporarily restricted.\n\nBrowse the shop: ${data.shopUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function paymentMissedFlaggedTemplate(
  data: PaymentMissedFlaggedEmailData
): EmailTemplate {
  return {
    subject: "Your bidding privileges are temporarily restricted",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.payment_missed_flagged)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Bidding Restricted</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName || "there")}, we've temporarily restricted new bids on your account.</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">Our system flagged ${data.strikeCount} missed payment deadline(s) within the last ${data.windowDays} days. Reason on file: <em>${escapeHtml(data.reason)}</em>.</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">You can still browse, buy-it-now, and sell. Only bidding on new auctions is paused while an admin reviews your account.</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">If you think this is a mistake or you'd like to appeal, reach out to support and we'll take another look.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.supportUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">CONTACT SUPPORT →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Bidding restricted.\n\nWe've temporarily restricted new bids on your account. Our system flagged ${data.strikeCount} missed payment deadline(s) within the last ${data.windowDays} days. Reason: ${data.reason}.\n\nYou can still browse, buy-it-now, and sell. If you'd like to appeal, contact support.\n\nSupport: ${data.supportUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

// ============================================================================
// Subscription Payment Failed
// ----------------------------------------------------------------------------
// Fires from the Stripe webhook handler on `invoice.payment_failed` for a
// subscription invoice. Stripe will auto-retry on its smart-retry schedule
// (typically 3 attempts over ~14 days) and dunning emails are NOT sent by
// Stripe by default — this template is our manual notification so the user
// can update their payment method before the subscription lapses to
// `unpaid`/`canceled`.
// ============================================================================

export function subscriptionPaymentFailedTemplate(
  data: SubscriptionPaymentFailedEmailData
): EmailTemplate {
  const reasonLine = data.failureReason
    ? `<p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">Reason on file: <em>${escapeHtml(data.failureReason)}</em>.</p>`
    : "";
  const retryLine = data.nextRetryAt
    ? `<p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">We'll automatically retry the charge on <strong>${data.nextRetryAt}</strong>. Update your payment method before then to keep Premium uninterrupted.</p>`
    : `<p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 12px;">Update your payment method to avoid losing your Premium features.</p>`;

  return {
    subject: "Action needed: your Premium payment didn't go through",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.subscription_payment_failed)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Payment didn't go through</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your latest Collectors Chest Premium charge couldn't be completed.</p>
          ${reasonLine}
          ${retryLine}
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.manageBillingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">UPDATE PAYMENT METHOD →</a>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin: 0;">If this is a temporary card issue (travel, fraud hold), check with your bank and we'll retry on schedule. If you'd like to cancel, you can do that from the same billing portal.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your Premium payment didn't go through.\n\n${data.failureReason ? `Reason: ${data.failureReason}.\n\n` : ""}${data.nextRetryAt ? `We'll automatically retry on ${data.nextRetryAt}. ` : ""}Update your payment method to keep Premium uninterrupted.\n\nManage billing: ${data.manageBillingUrl}\n\nIf this is a temporary card issue, check with your bank and we'll retry on schedule.\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

// ============================================================================
// Auction Ending Soon Reminder (T-1h to losing bidders)
// ----------------------------------------------------------------------------
// Fires once per auction from the cron pass at T-1h before end_time. Targets
// active bidders who placed a bid but are not currently winning — primary
// re-engagement audience. See BACKLOG "Auction Ending Soon Reminder for
// Active Bidders" (Apr 23, 2026 / closed Session 45).
// ============================================================================

export function auctionEndingSoonBidderTemplate(
  data: AuctionEndingSoonEmailData,
): EmailTemplate {
  const subject = `Ending ${data.timeRemainingLabel}: ${data.comicTitle} #${data.issueNumber}`;
  return {
    subject,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.auction_ending_soon_bidder)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Auction ending ${data.timeRemainingLabel}</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(data.recipientName)}, ${escapeHtml(data.comicTitle)} #${escapeHtml(data.issueNumber)} closes soon and you've been outbid.</p>
          <div style="background: #FFF8E7; border: 3px solid #000; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 14px;">
              <tr><td style="padding: 4px 0; color: #555;">Current bid</td><td style="padding: 4px 0; text-align: right; font-weight: bold; color: #000;">${formatPrice(data.currentBid)}</td></tr>
              <tr><td style="padding: 4px 0; color: #555;">Your max bid</td><td style="padding: 4px 0; text-align: right; color: #555;">${formatPrice(data.yourMaxBid)}</td></tr>
            </table>
          </div>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">Want this one? Raise your max before the auction closes.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">PLACE A BID →</a>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin: 0;">You're receiving this because you bid on this auction. Manage email preferences in your account settings.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Auction ending ${data.timeRemainingLabel}.\n\n${data.comicTitle} #${data.issueNumber}\nCurrent bid: ${formatPrice(data.currentBid)}\nYour max bid: ${formatPrice(data.yourMaxBid)}\n\nWant this one? Raise your max before the auction closes.\n\nPLACE A BID: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

// ============================================================================
// Bonus Scan Emails (guest email-capture flow)
// ----------------------------------------------------------------------------
// Sent from the /api/email-capture flow. Guests have no profile, so these
// bypass preference gating (profileId is never passed). Routed through the
// template system so they share the branded header/footer (L-EM14).
// ============================================================================

export function bonusScanVerifyTemplate(data: BonusScanVerifyEmailData): EmailTemplate {
  const bonusScans = GUEST_BONUS_SCAN_COUNT;
  return {
    subject: `Verify your email for ${bonusScans} bonus scans`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.bonus_scan_verify)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">Almost There!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Click the button below to verify your email and unlock <strong>${bonusScans} bonus scans</strong>:</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(data.verifyUrl)}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VERIFY EMAIL →</a>
          </div>
          <p style="font-size: 13px; color: #6b7280; line-height: 1.6; margin: 0;">This link expires in 24 hours. If you didn't request this, you can ignore this email.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Almost there!\n\nClick the link below to verify your email and unlock ${bonusScans} bonus scans:\n\n${data.verifyUrl}\n\nThis link expires in 24 hours. If you didn't request this, you can ignore this email.\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}

export function bonusScanGrantedTemplate(data: BonusScanGrantedEmailData): EmailTemplate {
  const bonusScans = GUEST_BONUS_SCAN_COUNT;
  return {
    subject: `You unlocked ${bonusScans} bonus scans!`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.bonus_scan_granted)}
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 22px; font-weight: 900; color: #000; margin: 0 0 16px;">You Got ${bonusScans} Bonus Scans!</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 12px;">Your email has been verified and you now have <strong>${bonusScans} extra scans</strong> to explore your comic collection. Here's what you can do:</p>
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-size: 14px; color: #333; margin: 0 0 16px;">
            <tr><td style="padding: 4px 0;">📸 Scan comic covers for instant AI recognition</td></tr>
            <tr><td style="padding: 4px 0;">📊 Get real-time eBay price estimates</td></tr>
            <tr><td style="padding: 4px 0;">🔑 See key issue information and first appearances</td></tr>
          </table>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(data.scanUrl)}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">START SCANNING →</a>
          </div>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0;">Want more? <a href="${escapeHtml(data.signUpUrl)}" style="color: #0066FF; font-weight: 700;">Create a free account</a> to get ${FREE_MONTHLY_SCAN_LIMIT} scans per month, plus cloud sync and more!</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `You got ${bonusScans} bonus scans!\n\nYour email has been verified and you now have ${bonusScans} extra scans to explore your comic collection.\n\nHere's what you can do:\n- Scan comic covers for instant AI recognition\n- Get real-time eBay price estimates\n- See key issue information and first appearances\n\nStart scanning: ${data.scanUrl}\n\nWant more? Create a free account (${data.signUpUrl}) to get ${FREE_MONTHLY_SCAN_LIMIT} scans per month, plus cloud sync and more!\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
