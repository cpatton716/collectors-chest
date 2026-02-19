"use client";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: February 18, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-sm p-8 prose prose-gray max-w-none">
          <h2>Collector&apos;s Chest Privacy Policy</h2>
          <p>
            <strong>Effective Date:</strong> [DATE]
          </p>
          <p>
            This Privacy Policy describes how [LEGAL BUSINESS NAME] (&quot;Company,&quot;
            &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, discloses, and
            protects your personal information when you use the Collector&apos;s Chest platform at
            collectors-chest.com and our mobile application (collectively, the &quot;Service&quot;).
            By using the Service, you consent to the data practices described in this policy.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>1.1 Information You Provide Directly</h3>
          <ul>
            <li>
              <strong>Account Information:</strong> Email address, first name, last name, and
              username (required for registration). Your email and name are never displayed publicly.
              Your username is displayed publicly.
            </li>
            <li>
              <strong>Optional Location:</strong> City, state/province, and country. You control the
              granularity of location sharing (full, state/country, country only, or hidden).
              Location is only collected if you affirmatively opt in.
            </li>
            <li>
              <strong>Collection Data:</strong> Information about your comic book collection,
              including titles, issue numbers, grades, prices, cover images, and notes.
            </li>
            <li>
              <strong>Marketplace Data:</strong> Listings, bids, offers, counter-offers, trade
              proposals, feedback, and ratings.
            </li>
            <li>
              <strong>Communications:</strong> Messages sent to other users through the
              Platform&apos;s messaging system.
            </li>
            <li>
              <strong>Payment Information:</strong> Payment details are collected and processed
              directly by Stripe. We do not store credit card numbers, bank account numbers, or
              other sensitive financial data on our servers. We receive only a Stripe Customer ID and
              transaction status information.
            </li>
          </ul>

          <h3>1.2 Information Collected Automatically</h3>
          <ul>
            <li>
              <strong>Usage Data:</strong> Pages viewed, features used, scan counts and timestamps,
              comic titles scanned, click events, and session data. Collected via PostHog analytics.
            </li>
            <li>
              <strong>Session Recordings:</strong> PostHog records a sample of user sessions
              (approximately 10% of sessions, and 100% of sessions where errors occur) to help us
              identify and fix bugs. These recordings capture on-screen interactions but do not
              capture keystrokes in password fields.
            </li>
            <li>
              <strong>Error Data:</strong> JavaScript errors, API failures, and performance metrics
              are captured by Sentry for debugging purposes. Error session replays are sampled at
              10%.
            </li>
            <li>
              <strong>Authentication Cookies:</strong> Our authentication provider (Clerk) sets
              session cookies necessary for maintaining your logged-in state.
            </li>
            <li>
              <strong>Analytics Identifiers:</strong> PostHog uses first-party cookies and
              localStorage for analytics purposes. PostHog respects the Do Not Track (DNT) browser
              setting; if you enable DNT, PostHog analytics will not track your activity.
            </li>
          </ul>

          <h3>1.3 Information We Do NOT Collect</h3>
          <ul>
            <li>Phone numbers</li>
            <li>
              Full mailing or shipping addresses (shipping is coordinated directly between users)
            </li>
            <li>Government-issued identification</li>
            <li>Precise geolocation or GPS data</li>
            <li>Biometric data</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect for the following purposes:</p>
          <ul>
            <li>
              <strong>Service Operation:</strong> To create and manage your account, sync your
              collection, process transactions, facilitate trades, and deliver core platform
              features.
            </li>
            <li>
              <strong>AI Features:</strong> To process comic book images through our AI
              identification system. Only the compressed image is sent to our AI provider
              (Anthropic); no personal data accompanies the image.
            </li>
            <li>
              <strong>Content Moderation:</strong> To review user-generated content (messages,
              listings, feedback) for compliance with our policies using automated AI moderation and
              manual review.
            </li>
            <li>
              <strong>Communications:</strong> To send transactional emails including offer
              notifications, listing alerts, message notifications, feedback reminders, and new
              listing alerts to followers. Emails are sent from notifications@collectors-chest.com
              via Resend.
            </li>
            <li>
              <strong>Improvement:</strong> To analyze usage patterns, diagnose technical issues, and
              improve the Service.
            </li>
            <li>
              <strong>Security:</strong> To detect and prevent fraud, abuse, and unauthorized access.
            </li>
            <li>
              <strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and
              legal processes.
            </li>
          </ul>

          <h2>3. Third-Party Service Providers</h2>
          <p>
            We share information with the following categories of third-party service providers,
            solely as necessary to operate the Service:
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Purpose</th>
                  <th>Data Shared</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Clerk</td>
                  <td>Authentication &amp; account management</td>
                  <td>Email, name, username, session data</td>
                </tr>
                <tr>
                  <td>Stripe</td>
                  <td>Payment processing, subscriptions</td>
                  <td>Payment method details, transaction data (handled directly by Stripe)</td>
                </tr>
                <tr>
                  <td>Supabase</td>
                  <td>Database &amp; file storage</td>
                  <td>
                    All platform data (profiles, collections, marketplace, messages)
                  </td>
                </tr>
                <tr>
                  <td>Anthropic (Claude)</td>
                  <td>AI comic identification, content moderation</td>
                  <td>Comic book images only (no personal data)</td>
                </tr>
                <tr>
                  <td>Upstash Redis</td>
                  <td>Caching &amp; rate limiting</td>
                  <td>Cached pricing, AI results, rate limit counters</td>
                </tr>
                <tr>
                  <td>Resend</td>
                  <td>Transactional email delivery</td>
                  <td>Email addresses, notification content</td>
                </tr>
                <tr>
                  <td>PostHog</td>
                  <td>Analytics &amp; session recording</td>
                  <td>Usage data, anonymized session recordings</td>
                </tr>
                <tr>
                  <td>Sentry</td>
                  <td>Error tracking &amp; monitoring</td>
                  <td>Error logs, performance metrics, sampled session replays</td>
                </tr>
                <tr>
                  <td>eBay API</td>
                  <td>Market pricing data</td>
                  <td>Comic book search queries (no user data)</td>
                </tr>
                <tr>
                  <td>Netlify</td>
                  <td>Web hosting &amp; deployment</td>
                  <td>Standard web server logs (IP addresses, request data)</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            We do not sell, rent, or trade your personal information to third parties for their
            marketing purposes. We do not use advertising trackers, marketing pixels, or third-party
            advertising cookies.
          </p>

          <h2>4. Data Retention</h2>
          <p>
            We retain your personal information for as long as your account is active or as needed to
            provide you the Service. Specific retention periods include:
          </p>
          <ul>
            <li>
              <strong>AI Analysis Cache:</strong> Results cached for 30 days by image hash.
            </li>
            <li>
              <strong>Pricing Data Cache:</strong> eBay pricing cached for 24 hours. Barcode lookups
              cached for 6 months. Certification lookups cached for 1 year.
            </li>
            <li>
              <strong>Account Deletion:</strong> When you delete your account, all of your data is
              permanently removed from our database (Supabase), including your profile, collection,
              listings, messages, trades, feedback, and follows. Stripe retains transaction records
              in accordance with their own data retention policy and applicable legal requirements.
            </li>
          </ul>

          <h2>5. Data Security</h2>
          <p>
            We implement reasonable technical and organizational measures to protect your personal
            information, including: database-level Row-Level Security (RLS) policies in Supabase to
            ensure users can only access their own data; rate limiting on all API endpoints via
            Upstash Redis; encryption in transit (HTTPS/TLS) for all data transmission; PCI-compliant
            payment processing through Stripe (card data never touches our servers); and
            authentication and session management through Clerk. While we strive to protect your
            information, no method of transmission over the Internet or electronic storage is 100%
            secure, and we cannot guarantee absolute security.
          </p>

          <h2>6. Your Rights and Choices</h2>

          <h3>6.1 All Users</h3>
          <ul>
            <li>
              Access and review the personal information in your account settings at any time.
            </li>
            <li>Update or correct your profile information.</li>
            <li>
              Adjust your location privacy settings (full, state/country, country only, or hidden).
            </li>
            <li>
              Delete your account and all associated data at any time through the account deletion
              process.
            </li>
            <li>
              Enable the Do Not Track (DNT) setting in your browser to opt out of PostHog analytics
              tracking.
            </li>
          </ul>

          <h3>6.2 California Residents (CCPA)</h3>
          <p>
            If you are a California resident, you have the following additional rights under the
            California Consumer Privacy Act (CCPA): the right to know what personal information we
            collect, use, and disclose; the right to request deletion of your personal information;
            the right to opt out of the sale of personal information (we do not sell personal
            information); and the right to non-discrimination for exercising your CCPA rights. To
            exercise these rights, contact us at [SUPPORT EMAIL].
          </p>

          <h3>
            6.3 European Economic Area, UK, and Swiss Residents (GDPR)
          </h3>
          <p>
            If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland,
            you have additional rights under the General Data Protection Regulation (GDPR),
            including: the right to access, rectify, or erase your personal data; the right to
            restrict or object to processing; the right to data portability; and the right to
            withdraw consent at any time. Our legal basis for processing your data is: performance of
            a contract (to provide the Service), legitimate interests (analytics, security, service
            improvement), and consent (optional location sharing, marketing communications if any).
            To exercise these rights, contact us at [SUPPORT EMAIL].
          </p>

          <h3>6.4 Do Not Track</h3>
          <p>
            Our analytics provider (PostHog) respects the Do Not Track (DNT) browser setting. When
            DNT is enabled, PostHog will not track your activity on the Platform. We do not use any
            other tracking technologies that respond to DNT signals.
          </p>

          <h2>7. Children&apos;s Privacy</h2>
          <p>
            The Service is not intended for individuals under the age of 18. We do not knowingly
            collect personal information from anyone under 18. If we become aware that we have
            collected personal information from a person under 18, we will take steps to delete that
            information promptly. If you believe a minor has provided us with personal information,
            please contact us at [SUPPORT EMAIL].
          </p>

          <h2>8. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your country
            of residence, including the United States, where our servers and service providers are
            located. These countries may have data protection laws that differ from those in your
            jurisdiction. By using the Service, you consent to such transfers. Where required by
            applicable law, we take steps to ensure adequate protection for your data during
            international transfers.
          </p>

          <h2>9. Changes to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on the Platform with a revised effective date and,
            where appropriate, by sending you an email notification. Your continued use of the
            Service after the effective date of any changes constitutes your acceptance of the
            revised policy.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have questions or concerns about this Privacy Policy or our data practices, please
            contact us at:
          </p>
          <p>
            [LEGAL BUSINESS NAME]
            <br />
            [ADDRESS]
            <br />
            [SUPPORT EMAIL]
            <br />
            Website: collectors-chest.com
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="container mx-auto px-4 py-8 text-center text-gray-500 text-sm">
        <Link href="/terms" className="hover:text-gray-700">
          Terms of Service
        </Link>
        <span className="mx-2">|</span>
        <Link href="/acceptable-use" className="hover:text-gray-700">
          Acceptable Use
        </Link>
        <span className="mx-2">|</span>
        <Link href="/cookies" className="hover:text-gray-700">
          Cookies
        </Link>
        <span className="mx-2">|</span>
        <Link href="/" className="hover:text-gray-700">
          Home
        </Link>
      </div>
    </div>
  );
}
