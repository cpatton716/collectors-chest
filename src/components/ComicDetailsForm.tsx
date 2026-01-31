"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  X,
} from "lucide-react";

import { calculateValueAtGrade } from "@/lib/gradePrice";

import {
  CollectionItem,
  ComicDetails,
  GRADE_SCALE,
  GRADING_COMPANIES,
  GradingCompany,
  PUBLISHERS,
} from "@/types/comic";

import { AddToKeyHuntButton } from "./AddToKeyHuntButton";
import { GradePricingBreakdown } from "./GradePricingBreakdown";
import { TitleAutocomplete } from "./TitleAutocomplete";

// Helper to generate certification verification URLs
function getCertVerificationUrl(certNumber: string, gradingCompany: string): string | null {
  if (!certNumber || !gradingCompany) return null;

  switch (gradingCompany.toUpperCase()) {
    case "CGC":
      return `https://www.cgccomics.com/certlookup/${certNumber}`;
    case "CBCS":
      return `https://cbcscomics.com/grading-notes/${certNumber}`;
    case "PGX":
      return `https://www.pgxcomics.com/certverification/pgxlabel.aspx?CertNo=${certNumber}`;
    default:
      return null;
  }
}

interface ComicDetailsFormProps {
  comic: ComicDetails;
  coverImageUrl: string;
  onCoverImageChange?: (url: string) => void;
  onSave: (item: Partial<CollectionItem>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  mode?: "add" | "edit";
  existingItem?: CollectionItem; // Pass full item for edit mode
}

export function ComicDetailsForm({
  comic: initialComic,
  coverImageUrl,
  onCoverImageChange,
  onSave,
  onCancel,
  isLoading,
  mode = "add",
  existingItem,
}: ComicDetailsFormProps) {
  const [comic, setComic] = useState<ComicDetails>({
    ...initialComic,
    keyInfo: initialComic.keyInfo || [],
  });
  // Custom key info added by user (separate from database key info)
  const [customKeyInfo, setCustomKeyInfo] = useState<string[]>(
    existingItem?.customKeyInfo || []
  );

  // Grading state - initialized from AI detection or existing item
  const [isGraded, setIsGraded] = useState(
    existingItem?.isGraded || initialComic.isSlabbed || false
  );
  const [gradingCompany, setGradingCompany] = useState<GradingCompany | "">(
    (existingItem?.gradingCompany as GradingCompany) || initialComic.gradingCompany || ""
  );
  const [grade, setGrade] = useState(
    existingItem?.conditionGrade?.toString() || initialComic.grade || ""
  );
  const [isSignatureSeries, setIsSignatureSeries] = useState(
    initialComic.isSignatureSeries || false
  );
  const [signedBy, setSignedBy] = useState(initialComic.signedBy || "");
  const [certificationNumber, setCertificationNumber] = useState(
    initialComic.certificationNumber || ""
  );
  const [isLookingUpCert, setIsLookingUpCert] = useState(false);

  // Other form state - initialized from existing item in edit mode
  const [purchasePrice, setPurchasePrice] = useState<string>(
    existingItem?.purchasePrice?.toString() || ""
  );
  const [notes, setNotes] = useState(existingItem?.notes || "");
  const [forSale, setForSale] = useState(existingItem?.forSale || false);
  const [askingPrice, setAskingPrice] = useState<string>(
    existingItem?.askingPrice?.toString() || ""
  );
  const [isSearchingCover, setIsSearchingCover] = useState(false);
  const [coverSearchUrl, setCoverSearchUrl] = useState<string | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [isLookingUpDetails, setIsLookingUpDetails] = useState(false);
  const [lastLookedUpTitle, setLastLookedUpTitle] = useState<string | null>(null);
  const [lastLookedUpIssue, setLastLookedUpIssue] = useState<string | null>(null);
  const [newKeyInfo, setNewKeyInfo] = useState("");

  // Track original values to detect changes in edit mode
  const [originalTitle] = useState(initialComic.title || "");
  const [originalIssue] = useState(initialComic.issueNumber || "");
  const [showRelookupPrompt, setShowRelookupPrompt] = useState(false);
  const [pendingRelookup, setPendingRelookup] = useState<{ title: string; issue: string } | null>(
    null
  );

  // Auto-populate publisher when title is selected
  useEffect(() => {
    const lookupPublisher = async () => {
      if (!comic.title || comic.title === lastLookedUpTitle || comic.publisher) return;

      setIsLookingUpDetails(true);
      try {
        const response = await fetch("/api/comic-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: comic.title, lookupType: "publisher" }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.publisher && !comic.publisher) {
            setComic((prev) => ({ ...prev, publisher: data.publisher }));
          }
          setLastLookedUpTitle(comic.title);
        }
      } catch (error) {
        console.error("Error looking up publisher:", error);
      } finally {
        setIsLookingUpDetails(false);
      }
    };

    const debounce = setTimeout(lookupPublisher, 500);
    return () => clearTimeout(debounce);
  }, [comic.title, comic.publisher, lastLookedUpTitle]);

  // Auto-populate details when title and issue number are both provided
  // Also re-fetch when title/issue changes from what was previously looked up
  useEffect(() => {
    const lookupDetails = async () => {
      if (!comic.title || !comic.issueNumber) return;

      const lookupKey = `${comic.title}-${comic.issueNumber}`;
      const previousKey = `${lastLookedUpTitle}-${lastLookedUpIssue}`;

      // Skip if we already looked up this exact combo
      if (lookupKey === previousKey) return;

      // Check if this is a CHANGE from a previous lookup (not first lookup)
      const isChange = lastLookedUpTitle && lastLookedUpIssue && lookupKey !== previousKey;

      // If it's a first lookup and data already exists, don't overwrite
      if (!isChange && comic.writer && comic.coverArtist && comic.releaseYear) return;

      setIsLookingUpDetails(true);
      try {
        const response = await fetch("/api/comic-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: comic.title,
            issueNumber: comic.issueNumber,
            lookupType: "full",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setComic((prev) => {
            // If title/issue changed, REPLACE the data; otherwise merge
            if (isChange) {
              return {
                ...prev,
                // Keep user-entered title/issue
                title: prev.title,
                issueNumber: prev.issueNumber,
                variant: prev.variant,
                // Replace looked-up data with fresh data
                publisher: data.publisher,
                releaseYear: data.releaseYear,
                writer: data.writer,
                coverArtist: data.coverArtist,
                interiorArtist: data.interiorArtist,
                keyInfo: data.keyInfo || [],
                priceData: data.priceData,
              };
            }
            // First lookup - merge (don't overwrite existing)
            return {
              ...prev,
              publisher: prev.publisher || data.publisher,
              releaseYear: prev.releaseYear || data.releaseYear,
              writer: prev.writer || data.writer,
              coverArtist: prev.coverArtist || data.coverArtist,
              interiorArtist: prev.interiorArtist || data.interiorArtist,
              keyInfo: prev.keyInfo?.length ? prev.keyInfo : data.keyInfo || [],
              priceData: prev.priceData || data.priceData,
            };
          });
          setLastLookedUpTitle(comic.title);
          setLastLookedUpIssue(comic.issueNumber);
        }
      } catch (error) {
        console.error("Error looking up comic details:", error);
      } finally {
        setIsLookingUpDetails(false);
      }
    };

    const debounce = setTimeout(lookupDetails, 800);
    return () => clearTimeout(debounce);
  }, [
    comic.title,
    comic.issueNumber,
    comic.writer,
    comic.coverArtist,
    comic.releaseYear,
    lastLookedUpTitle,
    lastLookedUpIssue,
  ]);

  // Update form when initialComic changes (e.g., when API returns data)
  useEffect(() => {
    setComic({
      ...initialComic,
      keyInfo: initialComic.keyInfo || [],
    });
    // Update grading fields from AI detection
    setIsGraded(initialComic.isSlabbed || false);
    setGradingCompany(initialComic.gradingCompany || "");
    setGrade(initialComic.grade || "");
    setIsSignatureSeries(initialComic.isSignatureSeries || false);
    setSignedBy(initialComic.signedBy || "");
  }, [initialComic]);

  // Detect title/issue changes in edit mode and prompt for re-lookup
  useEffect(() => {
    if (mode !== "edit") return;

    const titleChanged = comic.title && comic.title !== originalTitle && originalTitle !== "";
    const issueChanged =
      comic.issueNumber && comic.issueNumber !== originalIssue && originalIssue !== "";

    // Only show prompt if both title and issue are filled and at least one changed
    if ((titleChanged || issueChanged) && comic.title && comic.issueNumber) {
      // Check if we already have metadata that might be stale
      const hasExistingMetadata =
        comic.writer || comic.coverArtist || comic.publisher || comic.releaseYear;
      if (hasExistingMetadata && !showRelookupPrompt && !isLookingUpDetails) {
        setPendingRelookup({ title: comic.title, issue: comic.issueNumber });
        setShowRelookupPrompt(true);
      }
    }
  }, [
    comic.title,
    comic.issueNumber,
    originalTitle,
    originalIssue,
    mode,
    comic.writer,
    comic.coverArtist,
    comic.publisher,
    comic.releaseYear,
    showRelookupPrompt,
    isLookingUpDetails,
  ]);

  // Handle re-lookup confirmation
  const handleRelookup = async () => {
    if (!pendingRelookup) return;

    setShowRelookupPrompt(false);
    setIsLookingUpDetails(true);

    try {
      const response = await fetch("/api/comic-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pendingRelookup.title,
          issueNumber: pendingRelookup.issue,
          lookupType: "full",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update metadata fields but preserve user-entered data
        setComic((prev) => ({
          ...prev,
          publisher: data.publisher || null,
          releaseYear: data.releaseYear || null,
          writer: data.writer || null,
          coverArtist: data.coverArtist || null,
          interiorArtist: data.interiorArtist || null,
          keyInfo: data.keyInfo || [],
          priceData: data.priceData || null,
        }));
        setLastLookedUpTitle(pendingRelookup.title);
        setLastLookedUpIssue(pendingRelookup.issue);
      }
    } catch (error) {
      console.error("Error re-looking up comic details:", error);
    } finally {
      setIsLookingUpDetails(false);
      setPendingRelookup(null);
    }
  };

  const dismissRelookupPrompt = () => {
    setShowRelookupPrompt(false);
    setPendingRelookup(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSave({
      comic,
      coverImageUrl,
      conditionGrade: grade ? parseFloat(grade) : null,
      conditionLabel: null, // We're using numeric grades now
      isGraded,
      gradingCompany: isGraded && gradingCompany ? gradingCompany : null,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
      notes: notes || null,
      forSale,
      askingPrice: forSale && askingPrice ? parseFloat(askingPrice) : null,
      // Custom key info with pending status if user added any
      customKeyInfo,
      customKeyInfoStatus: customKeyInfo.length > 0 ? "pending" : null,
    });
  };

  const updateComic = (field: keyof ComicDetails, value: string | boolean | null) => {
    setComic((prev) => ({ ...prev, [field]: value }));
  };

  // Handle certification number lookup
  const handleCertLookup = async () => {
    if (!certificationNumber || !gradingCompany) return;

    setIsLookingUpCert(true);
    try {
      const response = await fetch("/api/cert-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certNumber: certificationNumber,
          gradingCompany,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Update comic details with cert data
          setComic((prev) => ({
            ...prev,
            title: data.data.title || prev.title,
            issueNumber: data.data.issueNumber || prev.issueNumber,
            publisher: data.data.publisher || prev.publisher,
            releaseYear: data.data.releaseYear || prev.releaseYear,
            variant: data.data.variant || prev.variant,
            labelType: data.data.labelType || prev.labelType,
            pageQuality: data.data.pageQuality || prev.pageQuality,
            gradeDate: data.data.gradeDate || prev.gradeDate,
            graderNotes: data.data.graderNotes || prev.graderNotes,
            certificationNumber: certificationNumber,
            // Map signatures to signedBy if present
            signedBy: data.data.signatures || prev.signedBy,
            isSignatureSeries: data.data.signatures ? true : prev.isSignatureSeries,
            // Map keyComments to keyInfo if present
            keyInfo: data.data.keyComments
              ? data.data.keyComments
                  .split(/[.\n]+/)
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 0)
              : prev.keyInfo,
          }));
          if (data.data.grade) {
            setGrade(data.data.grade);
          }
          // Update signature series state
          if (data.data.signatures) {
            setIsSignatureSeries(true);
            setSignedBy(data.data.signatures);
          }
        }
      }
    } catch (error) {
      console.error("Error looking up certification:", error);
    } finally {
      setIsLookingUpCert(false);
    }
  };

  const handleSearchCover = async () => {
    if (!comic.title) return;

    setIsSearchingCover(true);
    try {
      const response = await fetch("/api/cover-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: comic.title,
          issueNumber: comic.issueNumber,
          publisher: comic.publisher,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCoverSearchUrl(data.searchUrl);
        // Open the search URL in a new tab
        window.open(data.searchUrl, "_blank");
      }
    } catch (error) {
      console.error("Error searching for cover:", error);
    } finally {
      setIsSearchingCover(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Confidence Indicator */}
      {comic.confidence && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            comic.confidence === "high"
              ? "bg-green-50 text-green-700"
              : comic.confidence === "medium"
                ? "bg-yellow-50 text-yellow-700"
                : "bg-red-50 text-red-700"
          }`}
        >
          {comic.confidence === "high" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">
            {comic.confidence === "high"
              ? "High confidence - Most details identified"
              : comic.confidence === "medium"
                ? "Medium confidence - Please verify details"
                : "Low confidence - Manual entry recommended"}
          </span>
        </div>
      )}

      {/* Slabbed/Graded Alert */}
      {comic.isSlabbed && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-700">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">
            Graded comic detected - {comic.gradingCompany} {comic.grade}
            {comic.isSignatureSeries && " (Signature Series)"}
          </span>
        </div>
      )}

      {/* Re-lookup Prompt - shown when title/issue changes in edit mode */}
      {showRelookupPrompt && pendingRelookup && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
          <RefreshCw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Title or issue number changed</p>
            <p className="text-sm text-amber-700 mt-1">
              Would you like to look up new details for &quot;{pendingRelookup.title} #
              {pendingRelookup.issue}&quot;? This will update the publisher, year, creative team,
              and key info.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleRelookup}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Look Up New Details
              </button>
              <button
                type="button"
                onClick={dismissRelookupPrompt}
                className="px-3 py-1.5 bg-white text-amber-700 text-sm rounded-lg border border-amber-300 hover:bg-amber-50 transition-colors"
              >
                Keep Current Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            className={`block text-sm font-medium mb-1 ${!comic.title && comic.issueNumber ? "text-red-600" : "text-gray-700"}`}
          >
            Title <span className="text-red-500">*</span>
          </label>
          <TitleAutocomplete
            value={comic.title || ""}
            onChange={(value, years) => {
              updateComic("title", value);
              // If years are provided and no release year is set, extract the start year
              if (years && !comic.releaseYear) {
                const startYear = years.split("-")[0];
                if (startYear && /^\d{4}$/.test(startYear)) {
                  // Don't set a static year - let the lookup provide the specific issue year
                }
              }
            }}
            placeholder="e.g., Amazing Spider-Man"
            required
            className={!comic.title && comic.issueNumber ? "border-red-300 bg-red-50" : ""}
          />
          <p
            className={`text-xs mt-1 ${!comic.title && comic.issueNumber ? "text-red-600" : "text-gray-500"}`}
          >
            {!comic.title && comic.issueNumber ? (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Required for price lookup
              </span>
            ) : (
              "Start typing for suggestions"
            )}
          </p>
        </div>

        <div>
          <label
            className={`block text-sm font-medium mb-1 ${!comic.issueNumber && comic.title ? "text-red-600" : "text-gray-700"}`}
          >
            Issue Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={comic.issueNumber || ""}
            onChange={(e) => updateComic("issueNumber", e.target.value)}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 ${
              !comic.issueNumber && comic.title ? "border-red-300 bg-red-50" : "border-gray-300"
            }`}
            placeholder="e.g., 300"
            required
          />
          {!comic.issueNumber && comic.title && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Required for price lookup
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
          <select
            value={comic.publisher || ""}
            onChange={(e) => updateComic("publisher", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
          >
            <option value="">Select publisher...</option>
            {PUBLISHERS.map((pub) => (
              <option key={pub} value={pub}>
                {pub}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Release Year</label>
          <input
            type="text"
            value={comic.releaseYear || ""}
            onChange={(e) => updateComic("releaseYear", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
            placeholder="e.g., 1988"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
          <input
            type="text"
            value={comic.variant || ""}
            onChange={(e) => updateComic("variant", e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
            placeholder="e.g., Cover B, 1:25 Ratio"
          />
        </div>
      </div>

      {/* Cover Image Section - show for adding new cover or updating existing */}
      {comic.title && onCoverImageChange && (
        <div
          className={`p-4 rounded-lg space-y-3 order-first md:order-none ${coverImageUrl ? "bg-gray-50 border border-gray-200" : "bg-blue-50 border border-blue-200"}`}
        >
          <div>
            <p
              className={`text-sm font-medium ${coverImageUrl ? "text-gray-900" : "text-blue-900"}`}
            >
              {coverImageUrl ? "Cover Image" : "Add a cover image"}
            </p>
            {!coverImageUrl && (
              <>
                <p className="text-xs text-blue-700 hidden md:block">
                  Paste a cover image URL or search Google Images to find one.
                </p>
                <p className="text-xs text-blue-700 md:hidden">
                  Search for the cover image, then copy and paste the URL below.
                </p>
              </>
            )}
          </div>

          {/* Show current cover with change option */}
          {coverImageUrl && (
            <div className="flex items-start gap-4">
              <div className="w-16 h-24 flex-shrink-0 rounded-md overflow-hidden bg-gray-200 shadow-sm relative">
                <Image
                  src={coverImageUrl}
                  alt="Current cover"
                  fill
                  className="object-cover"
                  sizes="64px"
                  unoptimized
                />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-gray-500">Current cover image</p>
                {/* Mobile: Full-width buttons stacked */}
                <div className="md:hidden space-y-2">
                  <button
                    type="button"
                    onClick={handleSearchCover}
                    disabled={isSearchingCover}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    {isSearchingCover ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Find New Cover
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    Tap &amp; hold image → Open in new tab → Copy URL
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={coverUrlInput}
                      onChange={(e) => setCoverUrlInput(e.target.value)}
                      placeholder="Paste new image URL..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (coverUrlInput) {
                          onCoverImageChange(coverUrlInput);
                          setCoverUrlInput("");
                        }
                      }}
                      disabled={!coverUrlInput}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                    >
                      Set
                    </button>
                  </div>
                </div>
                {/* Desktop: Inline controls */}
                <div className="hidden md:block space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={coverUrlInput}
                      onChange={(e) => setCoverUrlInput(e.target.value)}
                      placeholder="Paste new image URL..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (coverUrlInput) {
                          onCoverImageChange(coverUrlInput);
                          setCoverUrlInput("");
                        }
                      }}
                      disabled={!coverUrlInput}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                    >
                      Update
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchCover}
                    disabled={isSearchingCover}
                    className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800"
                  >
                    {isSearchingCover ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search Google Images
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* No cover yet - show add options */}
          {!coverImageUrl && (
            <>
              {/* Mobile: Search button first, then paste area */}
              <div className="md:hidden space-y-3">
                <button
                  type="button"
                  onClick={handleSearchCover}
                  disabled={isSearchingCover}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  {isSearchingCover ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search Google Images
                  <ExternalLink className="w-4 h-4" />
                </button>
                <p className="text-xs text-blue-600 text-center">
                  Tap &amp; hold image → Open in new tab → Copy URL from address bar
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={coverUrlInput}
                    onChange={(e) => setCoverUrlInput(e.target.value)}
                    placeholder="Paste image URL here..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (coverUrlInput) {
                        onCoverImageChange(coverUrlInput);
                        setCoverUrlInput("");
                      }
                    }}
                    disabled={!coverUrlInput}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    Set
                  </button>
                </div>
              </div>

              {/* Desktop: URL input first, then search link */}
              <div className="hidden md:block space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={coverUrlInput}
                    onChange={(e) => setCoverUrlInput(e.target.value)}
                    placeholder="Paste image URL here..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (coverUrlInput) {
                        onCoverImageChange(coverUrlInput);
                        setCoverUrlInput("");
                      }
                    }}
                    disabled={!coverUrlInput}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    Set Cover
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSearchCover}
                  disabled={isSearchingCover}
                  className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800"
                >
                  {isSearchingCover ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search Google Images
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Creative Team */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          Creative Team
          {isLookingUpDetails && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-full animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Looking up details...
            </span>
          )}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Writer</label>
            <input
              type="text"
              value={comic.writer || ""}
              onChange={(e) => updateComic("writer", e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
              placeholder="e.g., Stan Lee"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Artist</label>
            <input
              type="text"
              value={comic.coverArtist || ""}
              onChange={(e) => updateComic("coverArtist", e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
              placeholder="e.g., Todd McFarlane"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interior Artist</label>
            <input
              type="text"
              value={comic.interiorArtist || ""}
              onChange={(e) => updateComic("interiorArtist", e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
              placeholder="e.g., John Romita"
            />
          </div>
        </div>
      </div>

      {/* Key Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-yellow-600" />
          Key Info
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          First appearances, deaths, team changes, and other significant events
        </p>

        {/* Database Key Info (read-only) */}
        {comic.keyInfo && comic.keyInfo.length > 0 && (
          <div className="space-y-2 mb-3">
            {comic.keyInfo.map((info, index) => (
              <div
                key={`db-${index}`}
                className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <span className="flex-1 text-sm text-gray-700">{info}</span>
                <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">
                  Verified
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Custom Key Info (user-added, with remove buttons) */}
        {customKeyInfo.length > 0 && (
          <div className="space-y-2 mb-3">
            {customKeyInfo.map((info, index) => (
              <div
                key={`custom-${index}`}
                className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg"
              >
                <span className="flex-1 text-sm text-gray-700">{info}</span>
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                  Pending
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomKeyInfo((prev) => prev.filter((_, i) => i !== index));
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove key info"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Key Info */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyInfo}
            onChange={(e) => setNewKeyInfo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newKeyInfo.trim()) {
                e.preventDefault();
                setCustomKeyInfo((prev) => [...prev, newKeyInfo.trim()]);
                setNewKeyInfo("");
              }
            }}
            placeholder="e.g., First appearance of Venom"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              if (newKeyInfo.trim()) {
                setCustomKeyInfo((prev) => [...prev, newKeyInfo.trim()]);
                setNewKeyInfo("");
              }
            }}
            disabled={!newKeyInfo.trim()}
            className="px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {customKeyInfo.length > 0 && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Custom key info is reviewed before appearing publicly
          </p>
        )}
      </div>

      {/* Grading */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Grading</h3>

        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isGraded}
              onChange={(e) => setIsGraded(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Professionally Graded (Slabbed)</span>
          </label>
        </div>

        {/* Grading details - only show when slabbed */}
        {isGraded && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grading Company
                </label>
                <select
                  value={gradingCompany}
                  onChange={(e) => setGradingCompany(e.target.value as GradingCompany | "")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                >
                  <option value="">Select company...</option>
                  {GRADING_COMPANIES.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                >
                  <option value="">Select grade...</option>
                  {GRADE_SCALE.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Certification Number */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certification Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={certificationNumber}
                  onChange={(e) => setCertificationNumber(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                  placeholder="e.g., 3904837001"
                />
                <button
                  type="button"
                  onClick={handleCertLookup}
                  disabled={!certificationNumber || !gradingCompany || isLookingUpCert}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {isLookingUpCert ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Lookup
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the cert number from the label to fetch details from{" "}
                {gradingCompany || "the grading company"}
              </p>
              {/* Clickable link to verification page */}
              {certificationNumber &&
                gradingCompany &&
                getCertVerificationUrl(certificationNumber, gradingCompany) && (
                  <a
                    href={getCertVerificationUrl(certificationNumber, gradingCompany) || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on {gradingCompany} website
                  </a>
                )}
            </div>

            {/* Grading Details Section - from cert lookup */}
            {(comic.pageQuality || comic.gradeDate || comic.graderNotes) && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <h4 className="text-sm font-medium text-slate-700">Grading Details</h4>

                {/* Page Quality */}
                {comic.pageQuality && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Page Quality
                    </label>
                    <p className="text-sm text-slate-700">{comic.pageQuality}</p>
                  </div>
                )}

                {/* Grade Date */}
                {comic.gradeDate && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Grade Date
                    </label>
                    <p className="text-sm text-slate-700">{comic.gradeDate}</p>
                  </div>
                )}

                {/* Grader Notes */}
                {comic.graderNotes && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Grader Notes
                    </label>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {comic.graderNotes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Signature Series */}
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSignatureSeries}
                  onChange={(e) => setIsSignatureSeries(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  Signature Series (Signed & Authenticated)
                </span>
              </label>

              {isSignatureSeries && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Signed By</label>
                  <input
                    type="text"
                    value={signedBy}
                    onChange={(e) => setSignedBy(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                    placeholder="e.g., Jim Starlin"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Estimated Value */}
      {comic.priceData &&
        comic.priceData.estimatedValue &&
        (() => {
          // Calculate grade-adjusted value
          const selectedGrade = grade ? parseFloat(grade) : null;
          const gradeAdjustedValue =
            selectedGrade && comic.priceData?.gradeEstimates
              ? calculateValueAtGrade(comic.priceData, selectedGrade, isGraded)
              : comic.priceData.estimatedValue;
          const displayValue = gradeAdjustedValue || comic.priceData.estimatedValue;

          return (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Estimated Value
                    {selectedGrade && comic.priceData?.gradeEstimates && (
                      <span className="text-xs font-normal text-gray-500">
                        ({isGraded ? "slabbed" : "raw"} {selectedGrade})
                      </span>
                    )}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-3xl font-bold text-green-700">
                      {displayValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {comic.priceData.mostRecentSaleDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Most recent sale:{" "}
                      {new Date(comic.priceData.mostRecentSaleDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>

                {/* Recent Sales Summary */}
                {comic.priceData.recentSales.length > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Recent Sales</p>
                    <div className="space-y-0.5">
                      {comic.priceData.recentSales.slice(0, 3).map((sale, idx) => (
                        <p key={idx} className="text-xs text-gray-600">
                          ${sale.price.toLocaleString()}
                          <span className="text-gray-400 ml-1">
                            (
                            {new Date(sale.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                            )
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Price Warning */}
              {comic.priceData.priceSource === "ai" && (
                <div className="mt-3 pt-3 border-t border-amber-200 bg-amber-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                  <p className="text-xs text-amber-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <span className="font-semibold">Technopathic Estimate:</span> No eBay sales
                      data found for this comic. This price is a technopathic estimate and may not
                      be accurate. Use caution when making buying or selling decisions.
                    </span>
                  </p>
                </div>
              )}

              {/* Signature Series Price Note */}
              {isSignatureSeries && (
                <div
                  className={`mt-3 pt-3 border-t border-blue-200 bg-blue-50 ${comic.priceData.priceSource === "ai" ? "" : "-mx-4 -mb-4 px-4 py-3 rounded-b-lg"}`}
                >
                  <p className="text-xs text-blue-700 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>
                      <span className="font-semibold">Signature Series:</span> Price based on
                      unsigned copies. Signed/authenticated comics often command a premium depending
                      on the signer.
                    </span>
                  </p>
                </div>
              )}

              {/* Disclaimer - only show for eBay data */}
              {comic.priceData.disclaimer && comic.priceData.priceSource !== "ai" && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-xs text-gray-500 flex items-start gap-1">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {comic.priceData.disclaimer}
                  </p>
                </div>
              )}

              {/* Grade-aware pricing breakdown */}
              <GradePricingBreakdown
                priceData={comic.priceData}
                currentGrade={selectedGrade}
                isSlabbed={isGraded}
              />
            </div>
          );
        })()}

      {/* Purchase Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Purchase Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Purchase Price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
              placeholder="e.g., 25.00"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
          placeholder="Any additional notes about this comic..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        {mode === "add" && (
          <AddToKeyHuntButton
            title={comic.title || ""}
            issueNumber={comic.issueNumber || ""}
            publisher={comic.publisher || undefined}
            releaseYear={comic.releaseYear || undefined}
            coverImageUrl={coverImageUrl}
            keyInfo={comic.keyInfo}
            currentPriceLow={
              comic.priceData?.estimatedValue ? comic.priceData.estimatedValue * 0.8 : undefined
            }
            currentPriceMid={comic.priceData?.estimatedValue || undefined}
            currentPriceHigh={
              comic.priceData?.estimatedValue ? comic.priceData.estimatedValue * 1.2 : undefined
            }
            addedFrom="scan"
            variant="compact"
          />
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === "add" ? "Add to Collection" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
