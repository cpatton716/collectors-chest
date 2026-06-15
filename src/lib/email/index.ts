// Internal barrel for the email submodules. Submodules import from siblings
// directly; this barrel exists for convenience and is re-exported by the
// public `@/lib/email` barrel (src/lib/email.ts) to preserve every original
// public import path. Submodules must NOT import from this barrel (avoids
// circular imports).
export {
  EMAIL_BATCH_SIZE,
  EMAIL_SOUND_EFFECTS,
  FROM_EMAIL,
  GUEST_BONUS_SCAN_COUNT,
  SUPPORT_EMAIL,
} from "./constants";
export {
  buildUnsubscribeHeaders,
  emailFooter,
  emailHeader,
  escapeHtml,
} from "./helpers";
export {
  getListingComicData,
  getProfileForEmail,
  getProfilesForEmail,
} from "./profiles";
export { sendNotificationEmail, sendNotificationEmailsBatch } from "./send";
export type {
  AuctionEndEmailData,
  BidActivityEmailData,
  FeedbackEmailData,
  MarketplaceTransactionEmailData,
  NewListingEmailData,
  NotificationEmailType,
  SendNotificationEmailParams,
  TrialExpiringEmailData,
  WelcomeEmailData,
} from "./types";
