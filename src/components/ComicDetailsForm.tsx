"use client";

import { useEffect, useState } from "react";

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";

import {
  CollectionItem,
  ComicDetails,
  GradingCompany,
  normalizePublisher,
  PUBLISHERS,
} from "@/types/comic";

import { AddToKeyHuntButton } from "./AddToKeyHuntButton";
import { TitleAutocomplete } from "./TitleAutocomplete";
import { CoverSourceSection } from "./comicDetail/CoverSourceSection";
import { GradingSection } from "./comicDetail/GradingSection";
import { KeyInfoSection } from "./comicDetail/KeyInfoSection";
import { PricingSection } from "./comicDetail/PricingSection";
import { RelookupPrompt } from "./comicDetail/RelookupPrompt";
import { SignatureSection } from "./comicDetail/SignatureSection";

// Helper to normalize grade values to match GRADE_SCALE format (e.g., "3" → "3.0")
function normalizeGrade(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (Number.isInteger(num) && num !== 10) return num.toFixed(1);
  return String(num);
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
  const [grade, setGrade] = useState(() => {
    const raw = existingItem?.conditionGrade?.toString() || initialComic.grade || "";
    return raw ? normalizeGrade(raw) : "";
  });
  const [isSignatureSeries, setIsSignatureSeries] = useState(
    initialComic.isSignatureSeries || false
  );
  const [signedBy, setSignedBy] = useState(initialComic.signedBy || "");
  // Multi-signature support: parse comma-separated signedBy into array
  const [signatures, setSignatures] = useState<string[]>(() => {
    const raw = initialComic.signedBy || "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  });
  const [newSignature, setNewSignature] = useState("");
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
  const [publisherSuggested, setPublisherSuggested] = useState(false);

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
            setComic((prev) => ({ ...prev, publisher: normalizePublisher(data.publisher) || data.publisher }));
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
                publisher: normalizePublisher(data.publisher) || data.publisher,
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
              publisher: prev.publisher || normalizePublisher(data.publisher) || data.publisher,
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
    setSignatures(
      (initialComic.signedBy || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    );
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
          publisher: normalizePublisher(data.publisher) || data.publisher || null,
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

    // Sync signatures back to comic before saving
    const signedByValue = signatures.length > 0 ? signatures.join(", ") : null;
    const updatedComic = {
      ...comic,
      signedBy: signedByValue,
      isSignatureSeries: signatures.length > 0 ? isSignatureSeries : false,
    };

    onSave({
      comic: updatedComic,
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
            setSignatures(
              data.data.signatures
                .split(",")
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0)
            );
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

  // Handle "Set Cover" from pasted URL - sets cover and submits to community cover DB
  const handleSetCover = () => {
    if (!coverUrlInput || !onCoverImageChange) return;

    // Set the cover image on the comic (existing behavior)
    onCoverImageChange(coverUrlInput);
    const submittedUrl = coverUrlInput;
    setCoverUrlInput("");

    // Fire-and-forget: submit to community cover database as pending
    try {
      const isValidUrl = /^https?:\/\/.+/.test(submittedUrl);
      if (isValidUrl && comic.title && comic.issueNumber) {
        fetch("/api/cover-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: comic.title,
            issueNumber: comic.issueNumber,
            imageUrl: submittedUrl,
            sourceQuery: "manual-paste",
            candidateCount: 2,
          }),
        }).catch(() => {
          // Silently ignore - community submission is best-effort
        });
      }
    } catch {
      // Silently ignore - community submission is best-effort
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
        <RelookupPrompt
          pendingRelookup={pendingRelookup}
          onRelookup={handleRelookup}
          onDismiss={dismissRelookupPrompt}
        />
      )}

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {/* NOTE: TitleAutocomplete does not forward an `id` or `aria-invalid` prop to its
              underlying input, so this label cannot be programmatically associated via htmlFor
              and aria-invalid cannot be set here. TitleAutocomplete is not owned by this change. */}
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
            htmlFor="cdf-issue-number"
            className={`block text-sm font-medium mb-1 ${!comic.issueNumber && comic.title ? "text-red-600" : "text-gray-700"}`}
          >
            Issue Number <span className="text-red-500">*</span>
          </label>
          <input
            id="cdf-issue-number"
            type="text"
            value={comic.issueNumber || ""}
            onChange={(e) => updateComic("issueNumber", e.target.value)}
            aria-invalid={!comic.issueNumber && !!comic.title}
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
          <label htmlFor="cdf-publisher" className="block text-sm font-medium text-gray-700 mb-1">
            Publisher
          </label>
          <select
            id="cdf-publisher"
            value={comic.publisher && PUBLISHERS.includes(comic.publisher) ? comic.publisher : ""}
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
          {comic.publisher && !PUBLISHERS.includes(comic.publisher) && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xs text-amber-600">
                &quot;{comic.publisher}&quot; not in list
              </span>
              {publisherSuggested ? (
                <span className="text-xs text-green-600">Suggestion sent!</span>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/publishers/suggest", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ publisherName: comic.publisher }),
                      });
                      if (res.ok) {
                        setPublisherSuggested(true);
                      } else {
                        alert("Failed to submit suggestion. Please try again.");
                      }
                    } catch {
                      alert("Failed to submit suggestion. Please try again.");
                    }
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700 underline"
                >
                  Suggest Publisher
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="cdf-release-year" className="block text-sm font-medium text-gray-700 mb-1">
            Release Year
          </label>
          <input
            id="cdf-release-year"
            type="text"
            value={comic.releaseYear || ""}
            onChange={(e) => updateComic("releaseYear", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
            placeholder="e.g., 1988"
          />
        </div>

        <div>
          <label htmlFor="cdf-variant" className="block text-sm font-medium text-gray-700 mb-1">
            Variant
          </label>
          <input
            id="cdf-variant"
            type="text"
            value={comic.variant || ""}
            onChange={(e) => updateComic("variant", e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
            placeholder="e.g., Cover B, 1:25 Ratio"
          />
          {comic.variantSource && comic.variant && (
            <p className="mt-1 text-xs text-blue-700 flex items-center gap-1">
              <span aria-hidden>🔍</span>
              {comic.variantSource === "catalog"
                ? "Detected from community barcode catalog"
                : comic.variantSource === "ai"
                  ? "Detected from barcode + technopathic lookup — please confirm or edit"
                  : "Derived from barcode digits — confirm or replace with the artist/variant name"}
            </p>
          )}
        </div>
      </div>

      {/* Cover Image Section - show for adding new cover or updating existing */}
      {comic.title && onCoverImageChange && (
        <CoverSourceSection
          coverImageUrl={coverImageUrl}
          coverUrlInput={coverUrlInput}
          isSearchingCover={isSearchingCover}
          onCoverUrlInputChange={setCoverUrlInput}
          onSearchCover={handleSearchCover}
          onSetCover={handleSetCover}
        />
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
            <label htmlFor="cdf-writer" className="block text-sm font-medium text-gray-700 mb-1">
              Writer
            </label>
            <input
              id="cdf-writer"
              type="text"
              value={comic.writer || ""}
              onChange={(e) => updateComic("writer", e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
              placeholder="e.g., Stan Lee"
            />
          </div>

          <div>
            <label
              htmlFor="cdf-cover-artist"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cover Artist
            </label>
            <input
              id="cdf-cover-artist"
              type="text"
              value={comic.coverArtist || ""}
              onChange={(e) => updateComic("coverArtist", e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
              placeholder="e.g., Todd McFarlane"
            />
          </div>

          <div>
            <label
              htmlFor="cdf-interior-artist"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Interior Artist
            </label>
            <input
              id="cdf-interior-artist"
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
      <KeyInfoSection
        comic={comic}
        customKeyInfo={customKeyInfo}
        newKeyInfo={newKeyInfo}
        onNewKeyInfoChange={setNewKeyInfo}
        onAddKeyInfo={() => {
          if (newKeyInfo.trim()) {
            setCustomKeyInfo((prev) => [...prev, newKeyInfo.trim()]);
            setNewKeyInfo("");
          }
        }}
        onRemoveKeyInfo={(index) => {
          setCustomKeyInfo((prev) => prev.filter((_, i) => i !== index));
        }}
      />

      {/* Grading */}
      <GradingSection
        comic={comic}
        isGraded={isGraded}
        gradingCompany={gradingCompany}
        grade={grade}
        certificationNumber={certificationNumber}
        isLookingUpCert={isLookingUpCert}
        onIsGradedChange={setIsGraded}
        onGradingCompanyChange={setGradingCompany}
        onGradeChange={setGrade}
        onCertificationNumberChange={setCertificationNumber}
        onCertLookup={handleCertLookup}
      />

      {/* Signatures */}
      <SignatureSection
        isGraded={isGraded}
        isSignatureSeries={isSignatureSeries}
        signatures={signatures}
        newSignature={newSignature}
        onIsSignatureSeriesChange={setIsSignatureSeries}
        onNewSignatureChange={setNewSignature}
        onAddSignature={() => {
          if (newSignature.trim()) {
            setSignatures((prev) => [...prev, newSignature.trim()]);
            setNewSignature("");
          }
        }}
        onRemoveSignature={(index) => {
          setSignatures((prev) => prev.filter((_, i) => i !== index));
        }}
      />

      {/* Estimated Value */}
      {comic.priceData && comic.priceData.estimatedValue && (
        <PricingSection
          comic={comic}
          grade={grade}
          isGraded={isGraded}
          isSignatureSeries={isSignatureSeries}
        />
      )}

      {/* Purchase Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Purchase Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="cdf-purchase-price"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Purchase Price ($)
            </label>
            <input
              id="cdf-purchase-price"
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
        <label htmlFor="cdf-notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          id="cdf-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
          placeholder="Any additional notes about this comic..."
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t">
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
