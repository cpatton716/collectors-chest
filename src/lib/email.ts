// ============================================================================
// EMAIL — PUBLIC BARREL (M-EM5 decomposition)
// ----------------------------------------------------------------------------
// This file used to contain the entire email subsystem (~1,774 lines). It was
// decomposed into cohesive submodules under `src/lib/email/`:
//   - constants.ts  — FROM_EMAIL, SUPPORT_EMAIL, GUEST_BONUS_SCAN_COUNT,
//                      EMAIL_SOUND_EFFECTS, EMAIL_BATCH_SIZE
//   - types.ts      — NotificationEmailType union + all email data interfaces
//   - helpers.ts    — escapeHtml, emailHeader, emailFooter,
//                      buildUnsubscribeHeaders, formatPrice, firstJoined
//   - profiles.ts   — getProfileForEmail, getListingComicData,
//                      resolveProfileIdByEmail
//   - templates.ts  — all *Template functions
//   - send.ts       — resolveNotificationTemplate, sendNotificationEmail,
//                      sendNotificationEmailsBatch, sendBatchWithRetry
//
// It is now a re-export barrel so every existing `@/lib/email` import keeps
// resolving its externally-used public exports with ZERO changes. The
// internal submodules import from siblings, never from this barrel, to avoid
// circular imports.
// ============================================================================

export {
  buildUnsubscribeHeaders,
  emailFooter,
  emailHeader,
  escapeHtml,
} from "./email/helpers";

export { getListingComicData, getProfileForEmail } from "./email/profiles";

export {
  sendNotificationEmail,
  sendNotificationEmailsBatch,
} from "./email/send";

export type {
  FeedbackEmailData,
  SendNotificationEmailParams,
} from "./email/types";
