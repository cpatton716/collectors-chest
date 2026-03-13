"use client";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";

export default function AcceptableUsePolicyPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Acceptable Use Policy</h1>
          <p className="text-gray-600 mt-2">Last updated: March 13, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-sm p-8 prose prose-gray max-w-none">
          <h2>Collector&apos;s Chest - Acceptable Use Policy</h2>
          <p>
            <strong>Effective Date:</strong> March 13, 2026
          </p>
          <p>
            This Acceptable Use Policy (&quot;AUP&quot;) governs your conduct when using the
            Collector&apos;s Chest platform (&quot;Service&quot;). This AUP is incorporated into and
            forms part of our Terms of Service. Violation of this AUP may result in content removal,
            account suspension, or permanent account termination at our sole discretion.
          </p>

          <h2>1. General Conduct Standards</h2>
          <p>
            All users of the Service are expected to act in good faith, treat other users with
            respect, and use the platform for its intended purpose: managing comic book collections
            and participating in legitimate comic book marketplace transactions and community
            contributions. The following sections describe specific prohibited and required behaviors.
          </p>

          <h2>2. Prohibited Content</h2>
          <p>
            You may not upload, post, send, or otherwise transmit any content through the Service
            that:
          </p>
          <ul>
            <li>
              Is unlawful, threatening, abusive, harassing, defamatory, libelous, deceptive,
              fraudulent, or tortious.
            </li>
            <li>
              Contains hate speech, slurs, or content that promotes discrimination based on race,
              ethnicity, gender, sexual orientation, religion, national origin, disability, or age.
            </li>
            <li>
              Is obscene, pornographic, sexually explicit, or depicts graphic violence.
            </li>
            <li>
              Infringes on the intellectual property rights of others, including unauthorized
              reproduction of copyrighted material beyond what is necessary for legitimate collection
              management.
            </li>
            <li>
              Contains personal or private information of another individual without their consent
              (including real names, addresses, phone numbers, or other identifying information).
            </li>
            <li>
              Contains malware, viruses, or any other harmful code or technology.
            </li>
            <li>
              Is spam, including unsolicited promotional content, chain messages, or bulk messaging.
            </li>
            <li>
              Impersonates another person, entity, or brand, or misrepresents your affiliation with
              any person or entity.
            </li>
          </ul>

          <h2>3. Prohibited Marketplace Conduct</h2>
          <p>
            When using the marketplace features (buying, selling, bidding, making offers, and
            trading), the following behaviors are strictly prohibited:
          </p>

          <h3>3.1 Fraudulent Activity</h3>
          <ul>
            <li>Listing items you do not own or do not intend to ship.</li>
            <li>
              Misrepresenting the condition, grade, authenticity, or any other material
              characteristic of a comic book.
            </li>
            <li>Listing counterfeit, bootleg, or reproduction items as originals.</li>
            <li>
              Accepting payment and failing to ship the item within a reasonable timeframe.
            </li>
            <li>
              Claiming non-receipt of an item that was delivered (as confirmed by tracking).
            </li>
          </ul>

          <h3>3.2 Bidding Manipulation</h3>
          <ul>
            <li>
              Shill bidding: placing bids on your own listings or coordinating with others to
              artificially inflate prices.
            </li>
            <li>
              Bid shielding: using secondary accounts or coordinating with others to place high bids
              and then retracting them to allow a lower bid to win.
            </li>
            <li>Using automated tools or bots to place bids.</li>
          </ul>

          <h3>3.3 Fee Avoidance</h3>
          <ul>
            <li>
              Directing buyers or sellers to complete transactions outside the Platform to avoid
              platform transaction fees for items originally listed on the Service.
            </li>
            <li>
              Manipulating sale prices to reduce transaction fees (e.g., listing an item for $1 and
              collecting the real price outside the Platform).
            </li>
          </ul>

          <h3>3.4 Trade Abuse</h3>
          <ul>
            <li>
              Proposing trades in bad faith (e.g., agreeing to a trade with no intention of
              shipping).
            </li>
            <li>Deliberately misgrading or misrepresenting comics in trade proposals.</li>
            <li>
              Shipping items that materially differ from what was agreed upon in the trade.
            </li>
          </ul>

          <h2>4. Community Contribution Standards</h2>
          <p>
            The Service includes community contribution features such as the Community Cover Database
            and the Creator Credits program. When participating in these features, the following
            rules apply:
          </p>

          <h3>4.1 Cover Image Submissions</h3>
          <ul>
            <li>
              You must only submit cover images that you have the right to share. Do not submit
              images that infringe on third-party copyrights without appropriate permission or legal
              basis.
            </li>
            <li>
              Submitted images must be actual comic book covers relevant to the comic title and
              issue they are associated with. Do not submit inappropriate, offensive, misleading, or
              unrelated images.
            </li>
            <li>Do not submit intentionally low-quality, corrupted, or blank images.</li>
            <li>
              Do not submit images that contain embedded text, watermarks, or overlays that are not
              part of the original cover (e.g., personal branding, advertising, or offensive text).
            </li>
          </ul>

          <h3>4.2 Creator Credits Integrity</h3>
          <ul>
            <li>
              Do not submit fraudulent, spam, or intentionally incorrect contributions for the
              purpose of inflating your Creator Credits count.
            </li>
            <li>
              Do not submit duplicate or near-duplicate content that has already been submitted or
              approved, except where the new submission is a meaningfully higher quality version.
            </li>
            <li>
              Do not use automated tools, bots, or scripts to generate or submit contributions.
            </li>
            <li>
              Do not coordinate with other users to artificially inflate each other&apos;s
              contribution counts through reciprocal low-quality submissions.
            </li>
          </ul>
          <p>
            Repeated submission of low-quality, inappropriate, or fraudulent content may result in
            temporary or permanent loss of submission privileges, Creator Credits revocation, or
            further account action at the Company&apos;s sole discretion.
          </p>

          <h2>5. Username Policy</h2>
          <p>
            Usernames are publicly visible and subject to the following rules. Usernames must not
            contain vulgar, offensive, obscene, or sexually explicit language; hate speech, slurs, or
            discriminatory terms; impersonation of other individuals, companies, or brands; references
            to illegal activities; or excessive special characters or formatting intended to disrupt
            the display of the Platform. Our automated content filtering system screens usernames at
            the time of creation. We reserve the right to require modification of any username that
            violates this policy, even if the automated filter did not catch it at registration.
          </p>

          <h2>6. Messaging Conduct</h2>
          <p>
            The Service provides a messaging system for users to communicate about collection items,
            trades, and marketplace transactions. When using messaging, you must not: send harassing,
            threatening, or abusive messages; send unsolicited commercial messages or spam; share
            personal information of third parties; attempt to solicit transactions outside the
            Platform for items listed on the Service; or send content that violates any other section
            of this AUP. Messages are subject to automated AI-powered content moderation. Violations
            detected by the moderation system may be flagged for manual review and may result in
            messaging restrictions or account action.
          </p>

          <h2>7. Account Integrity</h2>
          <p>
            You may maintain only one account on the Service. The following behaviors related to
            account integrity are prohibited:
          </p>
          <ul>
            <li>
              Creating multiple accounts to circumvent feature limitations of the free tier, to abuse
              free trial periods, or to reset scan allocations.
            </li>
            <li>
              Creating new accounts to evade a previous account suspension or termination.
            </li>
            <li>
              Sharing account credentials with others or allowing others to use your account.
            </li>
            <li>Using automated tools, bots, or scripts to create accounts.</li>
            <li>
              Misrepresenting your age during the marketplace age attestation process.
            </li>
          </ul>

          <h2>8. Technical Restrictions</h2>
          <p>
            You may not: attempt to gain unauthorized access to any part of the Service, other
            users&apos; accounts, or computer systems or networks connected to the Service; use
            automated tools, scrapers, bots, or scripts to access or interact with the Service
            without our prior written permission; attempt to reverse-engineer, decompile, disassemble,
            or otherwise derive the source code of the Service or its AI features; interfere with or
            disrupt the Service, servers, or networks connected to the Service, including through
            denial-of-service attacks; circumvent, disable, or otherwise interfere with security
            features of the Service, including rate limiting; or probe, scan, or test the
            vulnerability of the Service without our authorization.
          </p>

          <h2>9. Respect for Intellectual Property</h2>
          <p>
            While the Service is designed to display comic book cover images and metadata for
            collection management purposes, users must respect the intellectual property rights of
            publishers, creators, and other rights holders. You may not use the Service to distribute
            unauthorized digital copies of comic books, systematically download or archive cover
            images for use outside the Service, submit images to the Community Cover Database that
            you do not have the right to share, or use the Service&apos;s AI features to generate
            content that infringes on others&apos; intellectual property. If you believe content on
            the Service infringes your intellectual property rights, please contact us at Admin@collectorschest.com with a detailed description of the alleged infringement.
          </p>

          <h2>10. Reporting Violations</h2>
          <p>
            If you encounter content or behavior that violates this Acceptable Use Policy, please
            report it using the reporting functionality within the Platform or by contacting us at
            Admin@collectorschest.com. We take all reports seriously and will investigate promptly. We may, but
            are not obligated to, take action based on reports, including content removal, warnings,
            temporary suspension, or permanent account termination.
          </p>

          <h2>11. Enforcement</h2>
          <p>
            We reserve the right to enforce this AUP at our sole discretion. Enforcement actions may
            include, but are not limited to:
          </p>
          <ul>
            <li>
              <strong>Warning:</strong> A notification that specific content or behavior violates
              this AUP.
            </li>
            <li>
              <strong>Content Removal:</strong> Removal of content that violates this AUP, including
              cover image submissions.
            </li>
            <li>
              <strong>Feature Restriction:</strong> Temporary restriction of specific features (e.g.,
              messaging, marketplace access, community submission privileges).
            </li>
            <li>
              <strong>Creator Credits Revocation:</strong> Removal of credits and badges earned
              through fraudulent or abusive contributions.
            </li>
            <li>
              <strong>Account Suspension:</strong> Temporary suspension of account access.
            </li>
            <li>
              <strong>Account Termination:</strong> Permanent termination of the account and deletion
              of all associated data.
            </li>
          </ul>
          <p>
            In cases of severe violations, including fraud, illegal activity, or threats to user
            safety, enforcement may be immediate and without prior warning. Users whose accounts are
            terminated for AUP violations are not entitled to refunds of subscription fees or
            purchased scan credits.
          </p>

          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this Acceptable Use Policy from time to time. Material changes will be
            communicated through the Platform or via email. Continued use of the Service after changes
            take effect constitutes acceptance of the revised policy.
          </p>

          <h2>13. Contact Us</h2>
          <p>
            If you have questions about this Acceptable Use Policy, please contact us at:
          </p>
          <p>
            Twisted Jester LLC
            <br />
            889 Elm St
            <br />
            Hatfield, PA 19440
            <br />
            Admin@collectorschest.com
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
