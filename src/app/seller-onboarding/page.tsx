import fs from "node:fs";
import path from "node:path";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowLeft,
  Banknote,
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  FileText,
  HelpCircle,
  Lock,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Screenshot placeholder
// ---------------------------------------------------------------------------
// Renders the real screenshot from /public/seller-onboarding/<filename>.png
// if it exists, otherwise shows a yellow "SCREENSHOT NEEDED" placeholder so
// we can ship the page before images land. Drop a file in with the matching
// name and it auto-renders on the next render (no code changes required).
// ---------------------------------------------------------------------------
interface ScreenshotPlaceholderProps {
  stepNumber: number;
  filename: string;
  caption: string;
}

function screenshotExists(filename: string): boolean {
  try {
    const full = path.join(process.cwd(), "public", "seller-onboarding", `${filename}.png`);
    return fs.existsSync(full);
  } catch {
    return false;
  }
}

function ScreenshotPlaceholder({ stepNumber, filename, caption }: ScreenshotPlaceholderProps) {
  if (screenshotExists(filename)) {
    return (
      <div className="my-4 flex justify-center">
        <Image
          src={`/seller-onboarding/${filename}.png`}
          alt={caption}
          width={400}
          height={800}
          className="w-full max-w-xs sm:max-w-sm h-auto border-4 border-pop-black shadow-[6px_6px_0px_#000]"
        />
      </div>
    );
  }

  return (
    <div className="my-4 border-4 border-dashed border-pop-black bg-pop-yellow/60 p-4 sm:p-6 text-center shadow-comic-sm">
      <div className="flex items-center justify-center gap-2 mb-2">
        <Camera className="w-6 h-6 text-pop-black" aria-hidden="true" />
        <span className="font-comic text-pop-black text-sm sm:text-base tracking-wide">
          SCREENSHOT NEEDED
        </span>
      </div>
      <p className="font-body text-pop-black text-sm sm:text-base font-medium break-words">
        Step {stepNumber}: {caption}
      </p>
      <p className="mt-2 text-xs font-body text-pop-black/70 break-all">
        Save to <code className="bg-pop-white px-1 py-0.5 border border-pop-black">
          /public/seller-onboarding/{filename}.png
        </code>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card helper
// ---------------------------------------------------------------------------
interface StepCardProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function StepCard({ number, title, children }: StepCardProps) {
  return (
    <div className="relative bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-5 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4 mb-3">
        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-pop-red text-pop-white border-3 border-pop-black shadow-comic-sm flex items-center justify-center font-comic text-lg sm:text-xl">
          {number}
        </div>
        <h3 className="font-comic text-lg sm:text-2xl text-pop-black leading-tight pt-1">
          {title.toUpperCase()}
        </h3>
      </div>
      <div className="text-pop-black font-body text-sm sm:text-base space-y-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pro tip callout
// ---------------------------------------------------------------------------
function ProTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-pop-blue border-3 border-pop-black shadow-comic-sm p-3 sm:p-4 flex gap-3 items-start">
      <Sparkles className="w-5 h-5 text-pop-yellow flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="text-pop-white font-body text-sm sm:text-base">
        <span className="font-comic text-pop-yellow tracking-wide">PRO TIP:</span>{" "}
        <span>{children}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Critical callout
// ---------------------------------------------------------------------------
function CriticalCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-pop-yellow border-3 border-pop-black shadow-comic-sm p-3 sm:p-4 flex gap-3 items-start">
      <HelpCircle className="w-5 h-5 text-pop-red flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="text-pop-black font-body text-sm sm:text-base">
        <span className="font-comic text-pop-red tracking-wide">HEADS UP:</span>{" "}
        <span>{children}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trust cue (for Stripe reassurance on sensitive data screens)
// ---------------------------------------------------------------------------
function TrustCue({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-pop-green/15 border-3 border-pop-black shadow-comic-sm p-3 sm:p-4 flex gap-3 items-start">
      <Lock className="w-5 h-5 text-pop-green flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="text-pop-black font-body text-sm sm:text-base">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export const metadata = {
  title: "Seller Onboarding Guide | Collectors Chest",
  description:
    "A step-by-step walkthrough of Stripe seller onboarding for Collectors Chest. Takes about 3-5 minutes.",
};

export default function SellerOnboardingPage() {
  const SUPPORT_EMAIL = "admin@collectors-chest.com";

  return (
    <div className="min-h-screen bg-pop-cream">
      {/* Back link */}
      <div className="container mx-auto px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-body text-pop-black hover:text-pop-red transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-6 pb-8 sm:pt-10 sm:pb-12 max-w-4xl">
        <div className="relative overflow-hidden bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 sm:p-10 text-center">
          <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 dots-red opacity-25 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-32 sm:h-32 dots-blue opacity-20 pointer-events-none" />

          <h1
            className="relative font-comic text-3xl sm:text-5xl md:text-6xl text-pop-yellow tracking-wide leading-tight"
            style={{
              textShadow:
                "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, " +
                "-2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000, " +
                "4px 4px 0 #000",
            }}
          >
            SETTING UP YOUR SELLER ACCOUNT
          </h1>

          <div className="relative speech-bubble mt-6 mx-auto max-w-2xl">
            <p className="text-base sm:text-xl font-body text-pop-black">
              This takes about 3-5 minutes. Here&apos;s what you&apos;ll need and what to expect.
            </p>
          </div>

          {/* Trust badge row */}
          <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pop-green/20 border-2 border-pop-black font-comic text-xs sm:text-sm text-pop-black">
              <ShieldCheck className="w-4 h-4 text-pop-green" aria-hidden="true" />
              SECURE
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pop-yellow/40 border-2 border-pop-black font-comic text-xs sm:text-sm text-pop-black">
              <Sparkles className="w-4 h-4 text-pop-red" aria-hidden="true" />
              3-5 MINUTES
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pop-blue/15 border-2 border-pop-black font-comic text-xs sm:text-sm text-pop-black">
              <CreditCard className="w-4 h-4 text-pop-blue" aria-hidden="true" />
              POWERED BY STRIPE
            </span>
          </div>
        </div>
      </section>

      {/* What You'll Need */}
      <section className="container mx-auto px-4 pb-8 sm:pb-12 max-w-4xl">
        <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-5 sm:p-8">
          <h2 className="font-comic text-2xl sm:text-3xl text-pop-black mb-4 sm:mb-6 flex items-center gap-3">
            <div className="p-2 bg-pop-yellow border-2 border-pop-black shadow-comic-sm">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-pop-black" aria-hidden="true" />
            </div>
            WHAT YOU&apos;LL NEED
          </h2>

          <ul className="space-y-3">
            <li className="flex items-start gap-3 bg-pop-cream border-3 border-pop-black p-3 sm:p-4 shadow-comic-sm">
              <CheckCircle2 className="w-5 h-5 text-pop-green flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-body text-pop-black text-sm sm:text-base">
                Your <strong>legal name</strong> and <strong>date of birth</strong> (as they appear
                on government ID)
              </span>
            </li>
            <li className="flex items-start gap-3 bg-pop-cream border-3 border-pop-black p-3 sm:p-4 shadow-comic-sm">
              <CheckCircle2 className="w-5 h-5 text-pop-green flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-body text-pop-black text-sm sm:text-base">
                A <strong>US mobile phone</strong> (for SMS verification)
              </span>
            </li>
            <li className="flex items-start gap-3 bg-pop-cream border-3 border-pop-black p-3 sm:p-4 shadow-comic-sm">
              <CheckCircle2 className="w-5 h-5 text-pop-green flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-body text-pop-black text-sm sm:text-base">
                <strong>Online banking login</strong>: for the easiest path, Stripe Link connects
                instantly using your bank username and password. OR if you prefer: your bank{" "}
                <strong>account number + routing number</strong> for manual entry.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Walkthrough */}
      <section className="container mx-auto px-4 pb-8 sm:pb-12 max-w-4xl">
        <h2 className="font-comic text-2xl sm:text-4xl text-pop-black mb-6 sm:mb-8 text-center">
          STEP-BY-STEP WALKTHROUGH
        </h2>

        <div className="space-y-6 sm:space-y-8">
          {/* Step 1 */}
          <StepCard number={1} title="Enter your email and phone">
            <p>
              Stripe asks for your email address and US mobile phone number. Fill in both and tap{" "}
              <strong>Submit</strong>. Stripe then sends a 6-digit verification code by text to
              confirm your phone before moving on.
            </p>
            <div className="flex items-center gap-2 text-pop-black/70 text-xs sm:text-sm">
              <Phone className="w-4 h-4" aria-hidden="true" />
              <span>Use a number that can receive SMS. Landlines and VOIP may not work.</span>
            </div>
            <ScreenshotPlaceholder
              stepNumber={1}
              filename="01-verify-phone"
              caption="Stripe email and phone entry"
            />
            <ProTip>
              Use a real mobile number. Stripe blocks VoIP numbers. When the code arrives on the
              next screen, enter it to continue. If it doesn&apos;t come through, you can tap{" "}
              &quot;Resend code&quot; or switch to a different phone number.
            </ProTip>
          </StepCard>

          {/* Step 2 */}
          <StepCard number={2} title="Choose your business type">
            <p>
              Most hobbyist collectors select <strong>Individual</strong>. This is the right
              choice if you&apos;re selling from a personal collection. Choose{" "}
              <strong>Company</strong> only if you have a registered LLC, corporation, or sole
              proprietorship you want income routed to.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-pop-cream border-3 border-pop-black p-3 sm:p-4 shadow-comic-sm">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-pop-blue" aria-hidden="true" />
                  <span className="font-comic text-pop-blue text-sm tracking-wide">INDIVIDUAL</span>
                </div>
                <p className="text-xs sm:text-sm text-pop-black/80">
                  You&apos;re selling comics from your personal collection.
                </p>
              </div>
              <div className="bg-pop-cream border-3 border-pop-black p-3 sm:p-4 shadow-comic-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-pop-red" aria-hidden="true" />
                  <span className="font-comic text-pop-red text-sm tracking-wide">COMPANY</span>
                </div>
                <p className="text-xs sm:text-sm text-pop-black/80">
                  You have a registered LLC, corporation, or sole proprietorship.
                </p>
              </div>
            </div>
            <ScreenshotPlaceholder
              stepNumber={2}
              filename="02-business-type"
              caption="Stripe business type selection"
            />
          </StepCard>

          {/* Step 3 */}
          <StepCard number={3} title="Enter your legal name and website (or product description)">
            <p>Use your name exactly as it appears on your government ID.</p>
            <CriticalCallout>
              <strong>No website? No problem.</strong> Select the &quot;product description&quot;
              option and briefly describe what you sell. For example,{" "}
              <em>&quot;Comic books from my personal collection.&quot;</em> Most hobbyist sellers
              don&apos;t have a website and this path works fine.
            </CriticalCallout>
            <ScreenshotPlaceholder
              stepNumber={3}
              filename="03-legal-name-website"
              caption="Stripe legal name + website entry"
            />
          </StepCard>

          {/* Step 4 */}
          <StepCard number={4} title="Connect your bank with Stripe Link (recommended)">
            <p>
              Stripe shows a screen titled &quot;Collectors Chest uses Stripe to connect your
              accounts.&quot; This uses Stripe Link, the fastest way to finish setup. Link
              verifies your identity and connects your payout account in one step by signing you
              into your online banking, <strong>so you won&apos;t need to enter your SSN or
              address separately</strong>.
            </p>
            <TrustCue>
              <span className="font-comic text-pop-green tracking-wide">PRIVACY:</span>{" "}
              Your bank credentials are encrypted and handled entirely by Stripe Link. Collectors
              Chest never sees your login.
            </TrustCue>
            <p>
              Tap <strong>Agree and continue</strong>{" "}to use Link. (If you prefer to enter your
              bank details manually, tap &quot;Manually verify instead&quot; you&apos;ll be
              asked for your SSN last 4 and address on a later step.)
            </p>
            <ScreenshotPlaceholder
              stepNumber={4}
              filename="04-stripe-link-intro"
              caption="Stripe Link introduction and consent"
            />
          </StepCard>

          {/* Step 5 */}
          <StepCard number={5} title="Find your bank and sign in through Link">
            <p>
              Link shows a search list of supported US banks and credit unions. Find yours, tap
              it, and enter your online banking username and password. Link may send a verification
              code to your phone or email as a second factor.
            </p>
            <ProTip>
              Link supports most US banks and credit unions. If yours isn&apos;t listed, back out
              and select &quot;Enter bank account details manually&quot; to type in your routing
              and account numbers.
            </ProTip>
            <ScreenshotPlaceholder
              stepNumber={5}
              filename="05-bank-account"
              caption="Stripe Link bank search and sign-in"
            />
          </StepCard>

          {/* Step 6 */}
          <StepCard number={6} title="Select your payout account">
            <p>
              After Link connects your bank, Stripe shows every account it can pay out to. Pick
              the one you want your sale earnings deposited into, then tap <strong>Continue</strong>.
              This is the account your earnings will land in.
            </p>
            <TrustCue>
              <span className="font-comic text-pop-green tracking-wide">SECURITY:</span>{" "}
              Payouts typically arrive 2-5 business days after a sale completes.
            </TrustCue>
            <div className="flex items-center gap-2 text-pop-black/70 text-xs sm:text-sm">
              <Banknote className="w-4 h-4" aria-hidden="true" />
              <span>
                Double-check the last 4 digits of the account number match what you expected.
              </span>
            </div>
            <ScreenshotPlaceholder
              stepNumber={6}
              filename="06-select-bank-for-payouts"
              caption="Stripe payout account selection"
            />
          </StepCard>

          {/* Step 7 */}
          <StepCard number={7} title="Review and submit">
            <p>
              Stripe shows a summary of everything you&apos;ve entered. Double-check your name,
              business type, and linked bank. When it looks right, submit.
            </p>
            <ProTip>
              If Stripe rejects the submission, it usually means a detail doesn&apos;t match
              government records exactly. Try again with your name as it appears on your
              government ID.
            </ProTip>
            <ScreenshotPlaceholder
              stepNumber={7}
              filename="07-review-submit"
              caption="Stripe review and submit"
            />
          </StepCard>

          {/* Step 8 */}
          <StepCard number={8} title="Link success">
            <p>
              Link shows a &quot;Success: Your account is connected and saved with Link&quot;
              confirmation. Tap <strong>Done</strong> to move on.
            </p>
            <ScreenshotPlaceholder
              stepNumber={8}
              filename="08-link-success"
              caption="Stripe Link success confirmation"
            />
          </StepCard>

          {/* Step 9 */}
          <StepCard number={9} title="You're done!">
            <p>
              Stripe shows a final confirmation, then brings you back to Collectors Chest.
              You&apos;re now ready to list items for sale. If Stripe still needs a piece of info,
              we&apos;ll show a &quot;Finish seller setup&quot; banner. Just tap it to pick up
              where you left off.
            </p>
            <div className="bg-pop-green/15 border-3 border-pop-black p-3 sm:p-4 shadow-comic-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-pop-green flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-body text-pop-black text-sm sm:text-base">
                Once approved, you can start listing comics for sale right away.
              </span>
            </div>
            <ScreenshotPlaceholder
              stepNumber={9}
              filename="09-stripe-success"
              caption="Collectors Chest seller setup complete"
            />
          </StepCard>
        </div>
      </section>

      {/* After Onboarding */}
      <section className="container mx-auto px-4 pb-8 sm:pb-12 max-w-4xl">
        <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-5 sm:p-8">
          <h2 className="font-comic text-2xl sm:text-3xl text-pop-black mb-4 sm:mb-6 flex items-center gap-3">
            <div className="p-2 bg-pop-blue border-2 border-pop-black shadow-comic-sm">
              <Banknote className="w-5 h-5 sm:w-6 sm:h-6 text-pop-white" aria-hidden="true" />
            </div>
            AFTER ONBOARDING
          </h2>

          <div className="space-y-4">
            <div className="bg-pop-cream border-3 border-pop-black p-4 shadow-comic-sm">
              <h3 className="font-comic text-lg text-pop-black mb-1">HOW PAYOUTS WORK</h3>
              <p className="font-body text-sm sm:text-base text-pop-black">
                Payouts happen 2–5 business days after a sale completes. You can view your balance
                and payout schedule anytime in your Stripe Express Dashboard.
              </p>
            </div>

            <div className="bg-pop-cream border-3 border-pop-black p-4 shadow-comic-sm">
              <h3 className="font-comic text-lg text-pop-black mb-1">DISPUTES & CHARGEBACKS</h3>
              <p className="font-body text-sm sm:text-base text-pop-black">
                Collectors Chest handles first-line support for refunds and chargebacks. See our{" "}
                <Link
                  href="/terms#marketplace"
                  className="text-pop-blue underline decoration-2 underline-offset-2 hover:text-pop-red"
                >
                  Marketplace Policy
                </Link>{" "}
                for details.
              </p>
            </div>

            <div className="bg-pop-cream border-3 border-pop-black p-4 shadow-comic-sm">
              <h3 className="font-comic text-lg text-pop-black mb-1">UPDATING YOUR BANK INFO</h3>
              <p className="font-body text-sm sm:text-base text-pop-black">
                You can update your bank account, address, or other details anytime through the
                Stripe Express Dashboard. Changes take effect on your next payout.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="container mx-auto px-4 pb-8 sm:pb-12 max-w-4xl">
        <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-5 sm:p-8">
          <h2 className="font-comic text-2xl sm:text-3xl text-pop-black mb-4 sm:mb-6 flex items-center gap-3">
            <div className="p-2 bg-pop-red border-2 border-pop-black shadow-comic-sm">
              <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-pop-white" aria-hidden="true" />
            </div>
            TROUBLESHOOTING
          </h2>

          <div className="space-y-4">
            <details className="group bg-pop-cream border-3 border-pop-black shadow-comic-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between p-4 font-comic text-pop-black text-sm sm:text-base hover:bg-pop-yellow/30 transition-colors">
                <span>&quot;Stripe rejected my info&quot;</span>
                <span className="font-comic text-pop-blue text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t-2 border-pop-black font-body text-sm sm:text-base text-pop-black">
                This usually means your legal name, DOB, or address doesn&apos;t match government
                records exactly. Try again with your name as it appears on your government ID. If
                you still get rejected, contact Stripe Support directly.
              </div>
            </details>

            <details className="group bg-pop-cream border-3 border-pop-black shadow-comic-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between p-4 font-comic text-pop-black text-sm sm:text-base hover:bg-pop-yellow/30 transition-colors">
                <span>&quot;I want to cancel my seller account&quot;</span>
                <span className="font-comic text-pop-blue text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t-2 border-pop-black font-body text-sm sm:text-base text-pop-black">
                Email{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="text-pop-blue underline decoration-2 underline-offset-2 hover:text-pop-red break-all"
                >
                  {SUPPORT_EMAIL}
                </a>{" "}
                and we&apos;ll help you close it.
              </div>
            </details>

            <details className="group bg-pop-cream border-3 border-pop-black shadow-comic-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between p-4 font-comic text-pop-black text-sm sm:text-base hover:bg-pop-yellow/30 transition-colors">
                <span>&quot;My onboarding is stuck partway through&quot;</span>
                <span className="font-comic text-pop-blue text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t-2 border-pop-black font-body text-sm sm:text-base text-pop-black">
                If you bailed mid-onboarding, look for a &quot;Finish seller setup&quot; banner in
                your Collectors Chest settings or on the listing page when you try to list an item.
                Click it to resume.
              </div>
            </details>

            <details className="group bg-pop-cream border-3 border-pop-black shadow-comic-sm">
              <summary className="cursor-pointer list-none flex items-center justify-between p-4 font-comic text-pop-black text-sm sm:text-base hover:bg-pop-yellow/30 transition-colors">
                <span>&quot;Link didn&apos;t work with my bank&quot;</span>
                <span className="font-comic text-pop-blue text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-4 pb-4 pt-2 border-t-2 border-pop-black font-body text-sm sm:text-base text-pop-black">
                If Stripe Link doesn&apos;t support your bank, or you&apos;d rather enter details
                manually, back out when you see the Link screen and select &quot;Enter bank account
                details manually.&quot; You&apos;ll be prompted for your routing number, account
                number, SSN last 4, and address, a slightly longer path but fully supported.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Still need help? */}
      <section className="container mx-auto px-4 pb-12 sm:pb-16 max-w-4xl">
        <div className="relative overflow-hidden bg-pop-blue border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 sm:p-8 text-center">
          <div className="absolute top-0 right-0 w-20 h-20 sm:w-28 sm:h-28 dots-yellow opacity-25 pointer-events-none" />
          <h2 className="relative font-comic text-2xl sm:text-3xl text-pop-yellow mb-3 tracking-wide">
            STILL NEED HELP?
          </h2>
          <p className="relative font-body text-pop-white text-sm sm:text-base mb-5 max-w-xl mx-auto">
            Questions before you start? Email us. We usually respond within one business day.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="relative inline-flex items-center gap-2 px-5 py-3 bg-pop-yellow text-pop-black border-3 border-pop-black shadow-comic hover:shadow-comic-lg hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all font-comic text-sm sm:text-base tracking-wide break-all"
          >
            {SUPPORT_EMAIL}
          </a>
        </div>
      </section>

      {/* Footer */}
      <div className="container mx-auto px-4 py-6 sm:py-8 text-center text-pop-black/70 text-sm">
        <Link href="/terms" className="hover:text-pop-red">
          Terms
        </Link>
        <span className="mx-2">|</span>
        <Link href="/privacy" className="hover:text-pop-red">
          Privacy
        </Link>
        <span className="mx-2">|</span>
        <Link href="/" className="hover:text-pop-red">
          Home
        </Link>
      </div>
    </div>
  );
}
