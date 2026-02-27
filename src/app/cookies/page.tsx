"use client";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";

export default function CookieTrackingPolicyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Cookie &amp; Tracking Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: February 27, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-sm p-8 prose prose-gray max-w-none">
          <h2>Collector&apos;s Chest - Cookie &amp; Tracking Policy</h2>
          <p>
            <strong>Effective Date:</strong> [DATE]
          </p>
          <p>
            This Cookie &amp; Tracking Policy explains how Collector&apos;s Chest
            (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses cookies, local storage,
            session recordings, and similar technologies when you visit or use our platform at
            collectors-chest.com and our mobile application. This policy should be read alongside
            our{" "}
            <Link href="/privacy" className="text-blue-600 hover:text-blue-800">
              Privacy Policy
            </Link>
            .
          </p>

          <h2>1. What Are Cookies and Similar Technologies?</h2>
          <p>
            Cookies are small text files that are placed on your device when you visit a website.
            They are widely used to make websites work efficiently and to provide information to
            site operators. Local storage is a similar technology that allows websites to store data
            in your browser. We use both cookies and local storage, as well as session recording
            technology, as described below.
          </p>

          <h2>2. Cookies and Technologies We Use</h2>
          <p>
            We do not use any advertising cookies, marketing pixels, or third-party tracking
            cookies (such as Google Analytics or Facebook Pixel). The technologies we use fall into
            the following categories:
          </p>

          <h3>2.1 Strictly Necessary (Authentication)</h3>
          <p>
            These are essential for the Service to function and cannot be disabled.
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Technology</th>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Session cookies</td>
                  <td>Clerk</td>
                  <td>Cookie</td>
                  <td>
                    Maintain your logged-in session. Expire when you log out or after session
                    timeout.
                  </td>
                </tr>
                <tr>
                  <td>CSRF tokens</td>
                  <td>Clerk</td>
                  <td>Cookie</td>
                  <td>Protect against cross-site request forgery attacks.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>2.2 Analytics and Performance</h3>
          <p>
            These help us understand how users interact with the Service so we can improve it.
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Technology</th>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Analytics identifiers</td>
                  <td>PostHog</td>
                  <td>First-party cookie / localStorage</td>
                  <td>
                    Track page views, feature usage, and custom events (scans, bids, signups).
                    Respects Do Not Track (DNT).
                  </td>
                </tr>
                <tr>
                  <td>Error tracking</td>
                  <td>Sentry</td>
                  <td>No cookies</td>
                  <td>
                    Captures JavaScript errors, API failures, and performance data. Does not set
                    cookies.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>2.3 Functional (Guest Users)</h3>
          <p>
            These support features for users who have not created an account. All data in this
            category is stored exclusively in your browser and is never transmitted to our servers.
          </p>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Technology</th>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Guest collection data</td>
                  <td>Collector&apos;s Chest</td>
                  <td>localStorage</td>
                  <td>
                    Store comic collection data locally for guest users who have not created an
                    account. This data is not transmitted to our servers.
                  </td>
                </tr>
                <tr>
                  <td>Guest scan results</td>
                  <td>Collector&apos;s Chest</td>
                  <td>localStorage</td>
                  <td>
                    Store AI scan results (up to 3 scans) locally for guest users. Scan results
                    include comic metadata returned by the AI. This data is never transmitted to
                    our servers and can be cleared at any time through browser settings.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2>3. Session Recordings</h2>
          <p>
            We use PostHog&apos;s session recording feature to record a sample of user sessions on
            the Platform. This helps us identify usability issues, diagnose bugs, and improve the
            user experience.
          </p>
          <ul>
            <li>
              <strong>Sampling Rate:</strong> Approximately 10% of normal sessions are recorded.
              100% of sessions in which an error occurs are recorded.
            </li>
            <li>
              <strong>What Is Captured:</strong> Mouse movements, clicks, scrolls, page navigation,
              and on-screen content as rendered in the browser.
            </li>
            <li>
              <strong>What Is NOT Captured:</strong> Keystrokes in password fields are automatically
              masked. Credit card data is never present on our pages (payment is handled entirely by
              Stripe&apos;s hosted interface).
            </li>
            <li>
              <strong>DNT Opt-Out:</strong> If you enable the Do Not Track (DNT) setting in your
              browser, PostHog will not record your sessions or collect analytics data.
            </li>
          </ul>

          <h2>4. Third-Party Cookies</h2>
          <p>
            We do not permit third-party advertising networks to set cookies on the Platform. We do
            not use Google Analytics, Facebook Pixel, or any similar advertising or cross-site
            tracking technologies. The only third-party cookies that may be set are those from Clerk
            (our authentication provider) which are strictly necessary for login functionality.
          </p>

          <h2>5. Your Choices</h2>

          <h3>5.1 Do Not Track (DNT)</h3>
          <p>
            We honor the Do Not Track browser setting. When DNT is enabled, PostHog analytics and
            session recordings are disabled for your browsing session. To enable DNT, check your
            browser&apos;s privacy settings.
          </p>

          <h3>5.2 Browser Cookie Settings</h3>
          <p>
            Most browsers allow you to control cookies through their settings. You can typically
            choose to block all cookies, block third-party cookies, or delete cookies when you close
            the browser. Note that blocking strictly necessary cookies (Clerk authentication) will
            prevent you from logging into the Service.
          </p>

          <h3>5.3 localStorage</h3>
          <p>
            You can clear localStorage data through your browser&apos;s developer tools or
            settings. For guest users, clearing localStorage will remove your locally stored comic
            collection data and scan results. This action is permanent and cannot be undone.
          </p>

          <h2>6. Changes to This Policy</h2>
          <p>
            We may update this Cookie &amp; Tracking Policy from time to time. We will post any
            changes on this page with a revised effective date. Material changes will also be
            communicated via our Privacy Policy notification procedures.
          </p>

          <h2>7. Contact Us</h2>
          <p>
            If you have questions about this Cookie &amp; Tracking Policy, please contact us at:
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
        <Link href="/privacy" className="hover:text-gray-700">
          Privacy Policy
        </Link>
        <span className="mx-2">|</span>
        <Link href="/acceptable-use" className="hover:text-gray-700">
          Acceptable Use
        </Link>
        <span className="mx-2">|</span>
        <Link href="/" className="hover:text-gray-700">
          Home
        </Link>
      </div>
    </div>
  );
}
