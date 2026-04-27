"use client";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
          <p className="text-gray-600 mt-2">Last updated: March 13, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-xl shadow-sm p-8 prose prose-gray max-w-none">
          <h2>Collector&apos;s Chest - Terms of Service</h2>

          <p>
            <strong>Effective Date:</strong> March 13, 2026
          </p>

          <p>
            Welcome to Collector&apos;s Chest (the &quot;Service&quot;), a comic book collection
            management and marketplace platform operated by Twisted Jester LLC, a Pennsylvania limited
            liability company (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;). The Service is accessible via our website at collectors-chest.com and
            our mobile application (collectively, the &quot;Platform&quot;).
          </p>

          <p>
            By accessing or using the Service, you agree to be bound by these Terms of Service
            (&quot;Terms&quot;). If you do not agree, you may not use the Service. We reserve the
            right to update these Terms at any time. Continued use after changes constitutes
            acceptance.
          </p>

          <h2>1. Eligibility</h2>
          <p>
            You must be at least 18 years of age to create an account or use any feature of the
            Service. By registering, you represent and warrant that you are at least 18 years old
            and have the legal capacity to enter into a binding agreement. We reserve the right to
            request verification of age at any time and to terminate accounts that we reasonably
            believe belong to individuals under 18.
          </p>

          <h2>2. Account Registration and Security</h2>

          <h3>2.1 Account Creation</h3>
          <p>
            To access certain features of the Service, you must create a registered account.
            Registration requires the following information: a valid email address (not displayed
            publicly), your first and last name, and a username of your choosing (displayed
            publicly). Usernames are subject to our content filtering system, which prohibits
            vulgar, offensive, or otherwise inappropriate usernames. We reserve the right to reject
            or require modification of any username at our sole discretion.
          </p>

          <h3>2.2 Optional Information</h3>
          <p>
            You may optionally share your location (city, state/province, and/or country). Location
            sharing is entirely voluntary and can be configured at the following privacy levels: full
            location (city, state, country), state and country only, country only, or hidden.
            Location data, when shared, is used to facilitate trade and marketplace features.
          </p>

          <h3>2.3 Account Security</h3>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and
            for all activities that occur under your account. You agree to notify us immediately of
            any unauthorized use of your account. We are not liable for any loss or damage arising
            from your failure to protect your account information.
          </p>

          <h3>2.4 Account Tiers</h3>
          <p>The Service offers the following account tiers:</p>
          <ul>
            <li>
              <strong>Guest Access:</strong> Limited functionality without account registration.
              Guest data is stored locally in your browser and is not synced to the cloud. Guest
              access includes a lifetime maximum of 5 AI-powered comic scans, with the option to
              earn 5 additional scans by providing an email address (10 maximum). Guests cannot
              participate in marketplace, messaging, or trading features.
            </li>
            <li>
              <strong>Free Registered Account:</strong> Includes 10 AI-powered comic scans per
              calendar month (resetting on the 1st of each month), cloud-synced collection storage,
              the ability to buy and bid in the marketplace (with a maximum of 3 active sale
              listings), CSV import functionality, public profile, messaging, following, and trading
              features. Free accounts are subject to an 8% seller transaction fee on marketplace
              sales.
            </li>
            <li>
              <strong>Premium Account ($4.99/month or $49.99/year):</strong> Includes all Free tier
              features plus unlimited AI-powered comic scans, unlimited active sale listings, CSV
              export functionality, Key Hunt mode (offline convention lookup tool), advanced
              collection statistics, and a reduced 5% seller transaction fee. A 7-day free trial is
              available once per account.
            </li>
          </ul>

          <h2>3. Subscriptions, Payments, and Billing</h2>

          <h3>3.1 Subscription Billing</h3>
          <p>
            Premium subscriptions are billed on a recurring basis (monthly or annually) through our
            third-party payment processor, Stripe. By subscribing, you authorize Stripe to charge
            your selected payment method at the applicable rate. All fees are quoted in U.S. dollars
            unless otherwise stated.
          </p>

          <h3>3.2 Free Trial</h3>
          <p>
            New users may be eligible for a one-time, 7-day free trial of the Premium tier. You will
            not be charged during the trial period. If you do not cancel before the trial expires,
            your subscription will automatically convert to a paid Premium subscription and your
            payment method will be charged. Only one free trial is permitted per account.
          </p>

          <h3>3.3 Scan Packs</h3>
          <p>
            Free and Guest users may purchase additional AI scan credits in packs of 10 scans for
            $1.99 per pack. Purchased scan credits do not expire and are separate from the monthly
            allocation provided to Free registered accounts.
          </p>

          <h3>3.4 Cancellation and Refunds</h3>
          <p>
            You may cancel your Premium subscription at any time through the Stripe Customer Portal
            accessible within your account settings. Upon cancellation, you will retain access to
            Premium features until the end of your current billing period. No prorated refunds are
            provided for partial billing periods. Scan pack purchases are non-refundable.
          </p>

          <h3>3.5 Price Changes</h3>
          <p>
            We reserve the right to change subscription pricing at any time. We will provide at
            least 30 days&apos; notice of any price increase. If you do not agree to the new
            pricing, you may cancel your subscription before the new rate takes effect.
          </p>

          <h2>4. Marketplace</h2>

          <h3>4.1 General Marketplace Terms</h3>
          <p>
            The Service includes marketplace features that allow registered users to buy, sell, and
            trade comic books. The Company acts solely as a platform facilitator and is not a party
            to any transaction between users. We do not take possession of, inspect, authenticate,
            or guarantee any physical items listed on the marketplace. All transactions are between
            the buyer and seller (or trading parties) directly.
          </p>

          <h3>4.2 Marketplace Age Attestation</h3>
          <p>
            Before using any marketplace feature (including listing items for sale, purchasing,
            bidding, making offers, or initiating trades), you are required to confirm that you are
            at least 18 years of age through an on-screen attestation prompt. This self-attestation
            is legally binding. By confirming, you represent and warrant under penalty of account
            termination that you are at least 18 years old. Misrepresentation of your age constitutes
            a material breach of these Terms and is grounds for immediate account termination without
            refund. Your attestation confirmation is recorded with a timestamp for our records.
          </p>

          <h3>4.3 Fixed-Price Listings</h3>
          <p>
            Sellers may create fixed-price listings with a set asking price. Listings may include an
            &quot;accepts offers&quot; option with an optional minimum offer threshold. Offers and
            counter-offers are limited to three rounds of negotiation per listing, with each offer or
            counter-offer expiring after 48 hours if not responded to. Accepted offers follow the
            standard payment flow. Fixed-price listings auto-expire after 30 days if unsold.
          </p>

          <h3>4.4 Auction Listings</h3>
          <p>
            Sellers may create auction-style listings with a minimum starting price of $0.99 and a
            duration of 1 to 14 days. Auctions use a proxy bidding system: buyers enter a maximum
            bid amount, and the system automatically places incremental bids on their behalf. Bid
            increments are $1.00 for items under $100, $5.00 for items between $100 and $999, and
            $25.00 for items $1,000 and above. Bidder identities are anonymized (displayed as Bidder
            1, Bidder 2, etc.). Sellers may optionally set a Buy It Now price, which immediately
            ends the auction when exercised. A winning bidder has 48 hours to complete payment.
            Failure to pay within this period may result in account restrictions.
          </p>

          <h3>4.5 Transaction Fees</h3>
          <p>
            The Company charges the following seller transaction fees on completed marketplace sales:
            8% for Free tier accounts and 5% for Premium tier accounts. Transaction fees are
            calculated on the total sale amount (excluding shipping) and are deducted from the
            seller&apos;s payout. The applicable rate is set when the listing is created and remains
            in effect through completion of the sale, regardless of any subsequent change to the
            seller&apos;s subscription tier. Payment processing fees charged by Stripe are absorbed
            by the Company and are not deducted from the seller&apos;s payout.
          </p>

          <h3>4.6 Seller Payouts</h3>
          <p>
            Seller payouts for marketplace transactions are processed through Stripe Connect. The
            timing and method of payouts are subject to Stripe&apos;s terms and policies. We are not
            responsible for delays in payouts caused by Stripe or by a seller&apos;s failure to
            properly configure their payout information.
          </p>

          <h3>4.7 Shipping and Delivery</h3>
          <p>
            Buyers and sellers are solely responsible for coordinating shipping, including selecting
            carriers, providing tracking information, and ensuring adequate packaging and insurance.
            The Company is not responsible for items that are lost, damaged, or stolen during
            shipping. Sellers are required to mark items as shipped and provide tracking information
            within the Platform. Buyers are required to confirm receipt upon delivery.
          </p>

          <h3>4.8 Trading</h3>
          <p>
            Users may mark comics in their collection as available for trade. The Platform provides
            an algorithm-assisted matching system to identify potential trade partners with mutual
            interests. Trade proposals require both parties to agree to the proposed exchange. Once a
            trade is accepted, both parties must provide shipping carrier and tracking information. A
            trade is considered complete when both parties confirm receipt, at which point comic
            ownership is transferred in the Platform&apos;s database. Either party may cancel a
            trade at any time before both parties have shipped. The Company does not guarantee the
            value, condition, or authenticity of traded items.
          </p>

          <h3>4.9 Feedback and Ratings</h3>
          <p>
            After a completed transaction, buyers may leave a positive or negative rating along with
            a written comment for the seller. Feedback must comply with our Acceptable Use Policy.
            The Company reserves the right to remove feedback that violates these Terms or our
            Acceptable Use Policy.
          </p>

          <h3>4.10 Listing Cancellation</h3>
          <p>
            Auction listings may be cancelled only if no bids have been placed. Fixed-price listings
            may be cancelled at any time; any pending offers will be automatically rejected upon
            cancellation.
          </p>

          <h3>4.11 Refunds &amp; Chargebacks</h3>
          <p>
            Collectors Chest processes refunds and handles chargeback claims on behalf of the
            marketplace. Sellers do not directly manage refunds. When a buyer initiates a refund
            request or a chargeback, Collectors Chest reviews the claim, communicates with both
            parties, and coordinates with our payment processor (Stripe) to resolve the issue.
            Sellers agree to cooperate with refund and dispute investigations and to provide any
            requested documentation (shipping proof, communication records, etc.) promptly.
          </p>

          <h3>4.12 Seller Vetting &amp; Restricted Products</h3>
          <p>
            Collectors Chest reviews seller accounts to ensure compliance with these Terms and
            applicable law, including restrictions on counterfeit goods, stolen property, and
            unauthorized merchandise. We may decline, suspend, or terminate seller accounts at our
            discretion. Sellers are responsible for confirming that all listed items are authentic,
            legally owned, and permitted for resale under applicable law.
          </p>

          <h3>4.13 Risk &amp; Fraud Notifications to Sellers</h3>
          <p>
            If your seller account is affected by risk or fraud prevention actions, including
            holds, reviews, or restrictions, Collectors Chest will notify you with the reason for
            the action and any steps required to remediate. Notifications may be delivered by email,
            in-app notification, or both. Sellers are expected to respond to remediation requests
            promptly to restore their account.
          </p>

          <h3>4.14 Seller Remediation &amp; Additional Information</h3>
          <p>
            Collectors Chest may periodically request additional information from you to keep your
            seller account in good standing. This includes identity verification updates, business
            documentation, and compliance-related materials requested by our payment processor. You
            agree to provide requested information promptly; failure to respond within the stated
            timeframe may result in temporary account restrictions or suspension of payout access.
          </p>

          <h2>5. AI-Powered Features</h2>

          <h3>5.1 Comic Identification and Analysis</h3>
          <p>
            The Service uses artificial intelligence (powered by Anthropic&apos;s Claude API) to
            identify comic books from user-uploaded photographs. The AI attempts to extract metadata
            including title, issue number, publisher, release year, variant information, creator
            credits, grading information, and barcode data. AI-identified information is provided as
            a starting point and may contain errors. Users are responsible for reviewing and
            verifying all AI-generated data before saving it to their collection or using it for
            marketplace purposes.
          </p>

          <h3>5.2 Pricing Information</h3>
          <p>
            The Service provides pricing data sourced from current eBay listings. When market data
            is unavailable, no price is displayed. All pricing information is provided for
            informational purposes only and does not constitute an appraisal, guarantee of value,
            or recommendation to buy or sell at any particular price. The Company is not liable for
            decisions made based on pricing information displayed on the Platform.
          </p>

          <h3>5.3 Image Processing</h3>
          <p>
            When you use the AI scan feature, your uploaded image is processed in-memory on our
            servers and transmitted to Anthropic&apos;s API for analysis. Images are compressed
            client-side before upload (target approximately 400KB). Images are not permanently stored
            on our servers. Anthropic does not retain images after processing per their data
            retention policy. AI analysis results may be cached for up to 30 days (indexed by image
            hash) to improve performance. No personal user data is transmitted to Anthropic; only
            the comic book image is sent for analysis.
          </p>

          <h3>5.4 Content Moderation</h3>
          <p>
            The Service uses AI-powered content moderation to review user messages and other
            user-generated content for compliance with our Acceptable Use Policy. This moderation
            occurs automatically and is supplemented by manual review when necessary.
          </p>

          <h3>5.5 Disclaimer of AI Accuracy</h3>
          <p>
            AI-generated results, including but not limited to comic identification, grading
            information, key comic significance, and pricing estimates, are provided on an
            &quot;as-is&quot; basis without warranty of accuracy or completeness. The Company does
            not guarantee the correctness of any AI-generated output. You acknowledge that AI
            technology has inherent limitations and that errors may occur.
          </p>

          <h2>6. User Content, Conduct, and Community Contributions</h2>

          <h3>6.1 User-Generated Content</h3>
          <p>
            You retain ownership of content you upload to the Service, including comic book
            photographs, listing descriptions, messages, and feedback comments. By uploading content
            to the Service, you grant the Company a non-exclusive, worldwide, royalty-free license to
            use, display, reproduce, and distribute your content solely for the purpose of operating
            and improving the Service. This license terminates when you delete your content or your
            account, except where your content has been shared with other users (e.g., marketplace
            listings, feedback, messages) and reasonably needs to be retained for the integrity of
            those interactions.
          </p>

          <h3>6.2 Community Cover Database</h3>
          <p>
            The Service includes a Community Cover Database to which users may contribute comic book
            cover images. When you manually provide a cover image URL for a comic in your collection,
            that image may be automatically submitted to the Community Cover Database for review. An
            administrator will review and either approve or reject the submission. Approved images
            become available for display to all users of the Platform for the same comic title and
            issue.
          </p>
          <p>
            By submitting a cover image URL to the Service (whether through manual entry or any other
            submission method), you grant Collector&apos;s Chest a non-exclusive, perpetual,
            irrevocable, worldwide, royalty-free license to store, display, reproduce, and distribute
            the image to other users of the Platform for the purpose of comic book identification and
            collection management. You represent and warrant that you have the right to share any
            image you submit and that the image does not infringe on the intellectual property rights
            of any third party. The Company is not responsible for the accuracy, legality, or
            appropriateness of user-submitted cover images and reserves the right to remove or reject
            any submission at any time without notice.
          </p>

          <h3>6.3 Creator Credits Program</h3>
          <p>
            The Service offers a Creator Credits program that rewards users for contributing to the
            Platform&apos;s database. Users earn Creator Credits when they submit content (such as
            cover images to the Community Cover Database) that is reviewed and approved by an
            administrator. Each approved contribution increments the user&apos;s contribution count
            by one. Users earn publicly visible badge tiers based on their total approved
            contributions: Contributor (1-9 approved contributions), Verified Contributor (10-25
            approved contributions), and Top Contributor (26 or more approved contributions). Badges
            are displayed on the user&apos;s public profile.
          </p>
          <p>
            Creator Credits and associated badges are non-transferable, carry no monetary value, and
            cannot be redeemed, exchanged, or cashed out. The Company reserves the right to modify,
            suspend, or discontinue the Creator Credits program at any time, including changing badge
            tier thresholds, adding or removing contribution types, or resetting credit counts,
            without prior notice or liability. Submissions may be rejected at the sole discretion of
            the Company&apos;s administrators, and rejection does not entitle the user to any appeal
            or compensation. Duplicate contributions (the same content submitted by the same user)
            are automatically prevented.
          </p>

          <h3>6.4 Prohibited Conduct</h3>
          <p>
            You agree not to: use the Service for any unlawful purpose; post false, misleading, or
            fraudulent listings; manipulate bidding through shill bidding or other deceptive
            practices; harass, threaten, or abuse other users; attempt to circumvent platform fees by
            conducting transactions outside the Platform for items listed on the Platform; create
            multiple accounts to abuse free tier benefits, trial periods, or scan allocations; use
            automated tools, bots, or scripts to access the Service without our written permission;
            attempt to reverse-engineer, decompile, or otherwise extract the source code of the
            Service; upload content that infringes on the intellectual property rights of others;
            submit fraudulent, spam, or intentionally incorrect contributions to inflate Creator
            Credits; submit inappropriate, offensive, or unrelated images to the Community Cover
            Database; or otherwise violate our Acceptable Use Policy.
          </p>

          <h3>6.5 Enforcement</h3>
          <p>
            We reserve the right, at our sole discretion, to remove content, restrict features,
            suspend, or permanently terminate any account that violates these Terms or our Acceptable
            Use Policy, with or without notice. In cases of fraud, illegal activity, or severe
            violations, termination may be immediate.
          </p>

          <h2>7. Intellectual Property</h2>

          <h3>7.1 Company IP</h3>
          <p>
            The Service, including its design, features, code, AI models and integrations,
            algorithms, trade matching system, curated key comics database, and all related
            intellectual property, is owned by or licensed to the Company. Nothing in these Terms
            grants you any right, title, or interest in the Company&apos;s intellectual property
            except the limited right to use the Service in accordance with these Terms.
          </p>

          <h3>7.2 Third-Party IP</h3>
          <p>
            Comic book titles, cover artwork, character names, publisher names, and related
            intellectual property displayed on the Platform belong to their respective owners. The
            Service displays such materials for the purpose of collection management and marketplace
            transactions. Users are responsible for ensuring that their use of third-party
            intellectual property through the Service complies with applicable law.
          </p>

          <h3>7.3 Feedback and Suggestions</h3>
          <p>
            Any feedback, suggestions, or ideas you provide regarding the Service may be used by the
            Company without restriction or compensation to you.
          </p>

          <h2>8. Disclaimers and Limitation of Liability</h2>

          <h3>8.1 Disclaimer of Warranties</h3>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
            OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. TO THE FULLEST EXTENT
            PERMITTED BY LAW, THE COMPANY DISCLAIMS ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO
            NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF
            VIRUSES OR OTHER HARMFUL COMPONENTS.
          </p>

          <h3>8.2 Limitation of Liability</h3>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE COMPANY, ITS OFFICERS,
            DIRECTORS, MEMBERS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY
            INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT
            LIMITED TO LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF
            OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE, ANY TRANSACTION OR TRADE
            CONDUCTED THROUGH THE SERVICE, ANY AI-GENERATED CONTENT OR PRICING INFORMATION, OR ANY
            CONDUCT OF OTHER USERS. OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR
            RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT
            YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S.
            DOLLARS ($100.00).
          </p>

          <h3>8.3 Marketplace Disclaimer</h3>
          <p>
            The Company does not authenticate, inspect, appraise, or guarantee the condition, value,
            legality, or authenticity of any item listed on the marketplace. We are not responsible
            for the accuracy of listings, the quality or condition of items, the ability of sellers
            to complete a sale, or the ability of buyers to pay. Users transact at their own risk.
          </p>

          <h2>9. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless the Company and its officers,
            directors, members, employees, agents, and affiliates from and against any and all
            claims, damages, losses, liabilities, costs, and expenses (including reasonable
            attorneys&apos; fees) arising out of or related to: your use of the Service; your
            violation of these Terms or any applicable law; your marketplace transactions, trades, or
            interactions with other users; any content you upload or submit to the Service (including
            Community Cover Database submissions); or any dispute between you and another user.
          </p>

          <h2>10. Dispute Resolution</h2>

          <h3>10.1 First-Line Support for Marketplace Disputes</h3>
          <p>
            Collectors Chest provides first-line support for marketplace payment issues and
            disputes. Buyers and sellers should contact Collectors Chest support before escalating
            to their bank, card issuer, or payment processor. We respond to marketplace support
            inquiries within two business days and will work to resolve issues directly where
            possible. If we are unable to resolve a dispute, you may seek remedies available to you
            under applicable law.
          </p>

          <h3>10.2 Between You and the Company</h3>
          <p>
            Any dispute, claim, or controversy arising out of or relating to these Terms or the
            Service shall first be attempted to be resolved through informal negotiation by
            contacting us at admin@collectors-chest.com. If the dispute cannot be resolved informally within 30
            days, either party may pursue resolution through binding arbitration administered by the
            American Arbitration Association (AAA) under its Consumer Arbitration Rules, conducted in
            Bucks County, Pennsylvania. You agree that any arbitration will be conducted on an individual basis
            and not as a class, consolidated, or representative action. The arbitrator&apos;s
            decision shall be final and binding.
          </p>

          <h3>10.3 Exceptions to Arbitration</h3>
          <p>
            Either party may seek injunctive or other equitable relief in a court of competent
            jurisdiction to prevent the actual or threatened infringement or misappropriation of
            intellectual property rights. Small claims court actions are also excluded from the
            arbitration requirement.
          </p>

          <h2>11. Termination</h2>
          <p>
            You may terminate your account at any time through the account deletion process provided
            in the Service. Upon account deletion, all of your data will be permanently removed from
            our systems, including your profile, collection, marketplace listings, messages, trades,
            feedback, follows, Creator Credits, and Community Cover Database submission records.
            Approved cover images that have been made available to the community may be retained in
            the Community Cover Database after account deletion, as they are licensed to the Company
            under the terms described in Section 6.2. Certain transaction records may be retained by
            our payment processor (Stripe) in accordance with their policies and applicable legal
            requirements.
          </p>
          <p>
            We may suspend or terminate your account at any time for any reason, including but not
            limited to violation of these Terms. If your account is terminated by us for cause, you
            are not entitled to any refund of prepaid subscription fees or purchased scan credits.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the
            Commonwealth of Pennsylvania, without regard to its conflict of law provisions.
          </p>

          <h2>13. Miscellaneous</h2>

          <h3>13.1 Entire Agreement</h3>
          <p>
            These Terms, together with our Privacy Policy, Cookie &amp; Tracking Policy, and
            Acceptable Use Policy, constitute the entire agreement between you and the Company
            regarding your use of the Service.
          </p>

          <h3>13.2 Severability</h3>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that provision
            shall be limited or eliminated to the minimum extent necessary, and the remaining
            provisions shall remain in full force and effect.
          </p>

          <h3>13.3 Waiver</h3>
          <p>
            The failure of the Company to enforce any right or provision of these Terms shall not
            constitute a waiver of that right or provision.
          </p>

          <h3>13.4 Assignment</h3>
          <p>
            You may not assign or transfer these Terms or your rights under them without our prior
            written consent. We may assign our rights and obligations under these Terms without
            restriction.
          </p>

          <h3>13.5 Notices</h3>
          <p>
            We may provide notices to you via the email address associated with your account or
            through the Platform. You are responsible for keeping your email address current.
          </p>

          <h3>13.6 Contact Information</h3>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <p>
            Twisted Jester LLC
            <br />
            889 Elm St
            <br />
            Hatfield, PA 19440
            <br />
            admin@collectors-chest.com
            <br />
            Website: collectors-chest.com
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="container mx-auto px-4 py-8 text-center text-gray-500 text-sm">
        <Link href="/privacy" className="hover:text-gray-700">
          Privacy Policy
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
