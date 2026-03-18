"use client";

import { useCallback, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import { Database, History, Info, KeyRound, Loader2, Smartphone, Camera, Zap, Target } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import {
  CachedLookup,
  KeyHuntHistoryEntry,
  addToKeyHuntHistory,
  addToOfflineQueue,
  cacheLookup,
  generateCacheKey,
  getCachedLookup,
  getKeyHuntHistoryCount,
} from "@/lib/offlineCache";
import { storage } from "@/lib/storage";

import { useKeyHunt } from "@/hooks/useKeyHunt";
import { useOffline } from "@/hooks/useOffline";

import { FeatureGate } from "@/components/FeatureGate";
import { GradeSelector } from "@/components/GradeSelector";
import { ImageUpload } from "@/components/ImageUpload";
import { KeyHuntBottomSheet } from "@/components/KeyHuntBottomSheet";
import { KeyHuntHistoryDetail } from "@/components/KeyHuntHistoryDetail";
import { KeyHuntHistoryList } from "@/components/KeyHuntHistoryList";
import { KeyHuntManualEntry } from "@/components/KeyHuntManualEntry";
import { KeyHuntOfflineSearch } from "@/components/KeyHuntOfflineSearch";
import { KeyHuntPriceResult } from "@/components/KeyHuntPriceResult";
import { KeyHuntWishlist } from "@/components/KeyHuntWishlist";
import { OfflineIndicator, SyncNotification } from "@/components/OfflineIndicator";

import { CollectionItem, ComicDetails } from "@/types/comic";

type KeyHuntFlow =
  | "idle"
  | "options"
  | "cover-scan"
  | "cover-analyzing"
  | "manual-entry"
  | "grade-select"
  | "loading"
  | "result"
  | "error"
  | "offline-search"
  | "history"
  | "history-detail"
  | "my-list";

interface GradeEstimate {
  grade: number;
  label: string;
  rawValue: number;
  slabbedValue: number;
}

interface LookupResult {
  title: string;
  issueNumber: string;
  publisher?: string | null;
  releaseYear?: string | null;
  grade: number;
  averagePrice: number | null;
  recentSale: { price: number; date: string } | null;
  coverImageUrl?: string | null;
  keyInfo?: string[];
  gradeEstimates?: GradeEstimate[];
  fromCache?: boolean;
  source?: "database" | "ebay" | "ai";
}

export default function KeyHuntPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [flow, setFlow] = useState<KeyHuntFlow>("options");
  const [error, setError] = useState<string | null>(null);
  const { isOnline, isOfflineMode, pendingActionsCount, lastSyncResult, syncPendingActions } =
    useOffline();
  const { addToKeyHunt, isInKeyHunt } = useKeyHunt();
  const [showSyncNotification, setShowSyncNotification] = useState(false);

  // Lookup state
  const [pendingComic, setPendingComic] = useState<{
    title: string;
    issueNumber: string;
    publisher?: string | null;
    releaseYear?: string | null;
    coverImageUrl?: string | null;
    detectedGrade?: number | null;
    isSlabbed?: boolean;
    years?: string; // Series year range for disambiguation
  } | null>(null);

  const [result, setResult] = useState<LookupResult | null>(null);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<KeyHuntHistoryEntry | null>(
    null
  );

  // Show sync notification when lastSyncResult changes
  useEffect(() => {
    if (lastSyncResult && (lastSyncResult.synced > 0 || lastSyncResult.failed > 0)) {
      setShowSyncNotification(true);
    }
  }, [lastSyncResult]);

  // Handle option selection from bottom sheet
  const handleSelectOption = (
    option: "cover" | "barcode" | "manual" | "offline-search" | "history" | "my-list"
  ) => {
    setError(null);
    switch (option) {
      case "cover":
        if (isOfflineMode) {
          setError("Camera scanning is not available offline. Use cached lookups instead.");
          setFlow("error");
        } else {
          setFlow("cover-scan");
          // Scroll to top so camera area is visible on mobile
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        break;
      case "manual":
        setFlow("manual-entry");
        break;
      case "offline-search":
        setFlow("offline-search");
        break;
      case "history":
        setFlow("history");
        break;
      case "my-list":
        setFlow("my-list");
        break;
    }
  };

  // Handle cover scan image selection
  const handleCoverImageSelect = async (file: File, preview: string) => {
    setFlow("cover-analyzing");
    setError(null);

    try {
      const mediaType = file.type || "image/jpeg";

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview, mediaType }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          const errorMsg = errorData.error === "scan_limit_reached"
            ? "You've used all your free scans this month. Upgrade to Premium for unlimited scans!"
            : errorData.error || "Failed to analyze image";
          throw new Error(errorMsg);
        } else {
          throw new Error("The image took too long to process. Please try a smaller image.");
        }
      }

      const details: ComicDetails = await response.json();

      // Check if it's a slabbed comic with detected grade
      if (details.isSlabbed && details.grade) {
        // Auto-use detected grade
        setPendingComic({
          title: details.title || "Unknown",
          issueNumber: details.issueNumber || "1",
          publisher: details.publisher,
          releaseYear: details.releaseYear,
          coverImageUrl: preview,
          detectedGrade: parseFloat(details.grade),
          isSlabbed: true,
        });
        // Skip grade selection, go straight to lookup
        await performLookup(
          details.title || "Unknown",
          details.issueNumber || "1",
          parseFloat(details.grade)
        );
      } else {
        // Not slabbed - need grade selection
        setPendingComic({
          title: details.title || "Unknown",
          issueNumber: details.issueNumber || "1",
          publisher: details.publisher,
          releaseYear: details.releaseYear,
          coverImageUrl: preview,
          isSlabbed: false,
        });
        setFlow("grade-select");
      }
    } catch (err) {
      console.error("Cover scan error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze cover");
      setFlow("error");
    }
  };

  // Handle manual entry submission
  const handleManualSubmit = async (
    title: string,
    issueNumber: string,
    grade: number,
    years?: string
  ) => {
    setPendingComic({ title, issueNumber, years });
    await performLookup(title, issueNumber, grade, years);
  };

  // Handle grade selection
  const handleGradeSelect = async (grade: number) => {
    if (!pendingComic) return;
    await performLookup(pendingComic.title, pendingComic.issueNumber, grade, pendingComic.years);
  };

  // Handle selecting a cached result from offline search
  const handleSelectCachedResult = (cachedData: CachedLookup["data"]) => {
    setResult({
      ...cachedData,
      fromCache: true,
    });
    setFlow("result");
  };

  // Perform the actual price lookup
  const performLookup = async (
    title: string,
    issueNumber: string,
    grade: number,
    years?: string
  ) => {
    setFlow("loading");
    setError(null);

    // Include years in cache key for disambiguation
    const cacheKey = generateCacheKey(title + (years ? `-${years}` : ""), issueNumber, grade);

    // Check cache first (always, for faster response)
    const cachedResult = getCachedLookup(cacheKey);

    if (isOfflineMode) {
      // Offline: use cache only
      if (cachedResult) {
        setResult({
          ...cachedResult,
          fromCache: true,
        });
        setFlow("result");
      } else {
        setError("This comic is not cached. Connect to the internet for new lookups.");
        setFlow("error");
      }
      return;
    }

    // Online: try network, fall back to cache
    try {
      const response = await fetch("/api/con-mode-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, issueNumber, grade, years }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get price");
      }

      const data = await response.json();

      const lookupResult: LookupResult = {
        title: data.title,
        issueNumber: data.issueNumber,
        publisher: data.publisher,
        releaseYear: data.releaseYear,
        grade,
        averagePrice: data.averagePrice,
        recentSale: data.recentSale,
        coverImageUrl: pendingComic?.coverImageUrl || data.coverImageUrl,
        keyInfo: data.keyInfo,
        gradeEstimates: data.gradeEstimates,
        fromCache: false,
        source: data.source,
      };

      // Cache the result for offline use
      cacheLookup(cacheKey, {
        title: lookupResult.title,
        issueNumber: lookupResult.issueNumber,
        publisher: lookupResult.publisher,
        releaseYear: lookupResult.releaseYear,
        grade: lookupResult.grade,
        averagePrice: lookupResult.averagePrice,
        recentSale: lookupResult.recentSale,
        coverImageUrl: lookupResult.coverImageUrl,
        keyInfo: lookupResult.keyInfo,
        gradeEstimates: lookupResult.gradeEstimates,
      });

      // Save to scan history
      addToKeyHuntHistory({
        title: lookupResult.title,
        issueNumber: lookupResult.issueNumber,
        variant: undefined,
        publisher: lookupResult.publisher || undefined,
        grade: lookupResult.grade,
        isSlabbed: pendingComic?.isSlabbed || false,
        priceResult: {
          rawPrice: lookupResult.averagePrice,
          slabbedPrice: lookupResult.averagePrice, // Same for now
          recentSale: lookupResult.recentSale || undefined,
        },
        coverImageUrl: lookupResult.coverImageUrl || undefined,
      });

      setResult(lookupResult);
      setFlow("result");
    } catch (err) {
      console.error("Price lookup error:", err);

      // If we have cached data and network failed, use cache
      if (cachedResult) {
        setResult({
          ...cachedResult,
          fromCache: true,
        });
        setFlow("result");
      } else {
        setError(err instanceof Error ? err.message : "Failed to get price");
        setFlow("error");
      }
    }
  };

  // Handle adding to collection
  const handleAddToCollection = useCallback(() => {
    if (!result) return;

    if (isOfflineMode) {
      // Queue for offline sync
      addToOfflineQueue({
        type: "add_to_collection",
        data: {
          title: result.title,
          issueNumber: result.issueNumber,
          publisher: result.publisher,
          releaseYear: result.releaseYear,
          grade: result.grade,
          averagePrice: result.averagePrice,
          recentSale: result.recentSale,
          coverImageUrl: result.coverImageUrl,
          keyInfo: result.keyInfo,
        },
      });

      // Reset and show options
      setResult(null);
      setPendingComic(null);
      setFlow("options");
      return;
    }

    const item: CollectionItem = {
      id: uuidv4(),
      comic: {
        id: uuidv4(),
        title: result.title,
        issueNumber: result.issueNumber,
        variant: null,
        publisher: result.publisher || null,
        releaseYear: result.releaseYear || null,
        writer: null,
        coverArtist: null,
        interiorArtist: null,
        confidence: "high",
        isSlabbed: false,
        gradingCompany: null,
        grade: null,
        isSignatureSeries: false,
        signedBy: null,
        keyInfo: result.keyInfo || [],
        certificationNumber: null,
        labelType: null,
        pageQuality: null,
        gradeDate: null,
        graderNotes: null,
        priceData: result.averagePrice
          ? {
              estimatedValue: result.averagePrice,
              recentSales: result.recentSale
                ? [
                    {
                      ...result.recentSale,
                      source: "Technopathic Estimate",
                      isOlderThan6Months: false,
                    },
                  ]
                : [],
              mostRecentSaleDate: result.recentSale?.date || null,
              isAveraged: true,
              disclaimer: "Technopathic estimate",
            }
          : null,
      },
      coverImageUrl: result.coverImageUrl || "",
      conditionGrade: result.grade,
      conditionLabel: null,
      isGraded: false,
      gradingCompany: null,
      purchasePrice: null,
      purchaseDate: null,
      notes: "Added from Key Hunt",
      forSale: false,
      forTrade: false,
      askingPrice: null,
      averagePrice: result.averagePrice,
      dateAdded: new Date().toISOString(),
      listIds: [],
      isStarred: false,
      customKeyInfo: [],
      customKeyInfoStatus: null,
    };

    storage.addToCollection(item);

    // Reset and show options
    setResult(null);
    setPendingComic(null);
    setFlow("options");
  }, [result, isOfflineMode]);

  // Handle new lookup
  const handleNewLookup = () => {
    setResult(null);
    setPendingComic(null);
    setSelectedHistoryEntry(null);
    setError(null);
    setFlow("options");
    // Scroll to top so camera area is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle selecting a history entry to view details
  const handleSelectHistoryEntry = (entry: KeyHuntHistoryEntry) => {
    setSelectedHistoryEntry(entry);
    setFlow("history-detail");
  };

  // Handle re-lookup from history (fresh API call)
  const handleHistoryLookupAgain = (title: string, issueNumber: string, grade: number) => {
    setPendingComic({ title, issueNumber });
    setSelectedHistoryEntry(null);
    performLookup(title, issueNumber, grade);
  };

  // Handle adding to collection from history entry
  const handleAddFromHistory = useCallback(
    (entry: KeyHuntHistoryEntry) => {
      if (isOfflineMode) {
        // Queue for offline sync
        addToOfflineQueue({
          type: "add_to_collection",
          data: {
            title: entry.title,
            issueNumber: entry.issueNumber,
            publisher: entry.publisher,
            grade: entry.grade,
            averagePrice: entry.priceResult.rawPrice,
            recentSale: entry.priceResult.recentSale || null,
            coverImageUrl: entry.coverImageUrl,
          },
        });

        setSelectedHistoryEntry(null);
        setFlow("options");
        return;
      }

      const item: CollectionItem = {
        id: uuidv4(),
        comic: {
          id: uuidv4(),
          title: entry.title,
          issueNumber: entry.issueNumber,
          variant: entry.variant || null,
          publisher: entry.publisher || null,
          releaseYear: null,
          writer: null,
          coverArtist: null,
          interiorArtist: null,
          confidence: "high",
          isSlabbed: entry.isSlabbed,
          gradingCompany: null,
          grade: null,
          isSignatureSeries: false,
          signedBy: null,
          keyInfo: [],
          certificationNumber: null,
          labelType: null,
          pageQuality: null,
          gradeDate: null,
          graderNotes: null,
          priceData: entry.priceResult.rawPrice
            ? {
                estimatedValue: entry.priceResult.rawPrice,
                recentSales: entry.priceResult.recentSale
                  ? [
                      {
                        ...entry.priceResult.recentSale,
                        source: "Technopathic Estimate",
                        isOlderThan6Months: false,
                      },
                    ]
                  : [],
                mostRecentSaleDate: entry.priceResult.recentSale?.date || null,
                isAveraged: true,
                disclaimer: "Technopathic estimate",
              }
            : null,
        },
        coverImageUrl: entry.coverImageUrl || "",
        conditionGrade: entry.grade,
        conditionLabel: null,
        isGraded: entry.isSlabbed,
        gradingCompany: null,
        purchasePrice: null,
        purchaseDate: null,
        notes: "Added from Key Hunt History",
        forSale: false,
        forTrade: false,
        askingPrice: null,
        averagePrice: entry.priceResult.rawPrice,
        dateAdded: new Date().toISOString(),
        listIds: [],
        isStarred: false,
        customKeyInfo: [],
        customKeyInfoStatus: null,
      };

      storage.addToCollection(item);

      setSelectedHistoryEntry(null);
      setFlow("options");
    },
    [isOfflineMode]
  );

  // Handle close/back
  const handleClose = () => {
    router.back();
  };

  return (
    <FeatureGate feature="keyHunt">
      {/* Desktop Explainer - shown on md+ screens */}
      <div className="hidden md:block" style={{ background: "var(--pop-cream)" }}>
        <div className="max-w-4xl mx-auto px-6 py-12 pb-24">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 border-4 border-black shadow-[4px_4px_0px_#000]" style={{ background: "var(--pop-blue)" }}>
              <KeyRound className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: "var(--font-bangers)" }}>Key Hunt</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Your mobile companion for finding key comics at conventions, shops, and garage sales.
            </p>
          </div>

          {/* Mobile-Only Badge */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 border-3 border-black rounded-full shadow-[2px_2px_0px_#000]" style={{ background: "var(--pop-yellow)" }}>
              <Smartphone className="w-5 h-5 text-black" />
              <span className="text-black font-bold">Mobile Exclusive Feature</span>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="comic-panel p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Camera className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan Covers</h3>
              <p className="text-gray-600">
                Point your camera at any comic cover and instantly identify the issue with our technopathic recognition.
              </p>
            </div>

            <div className="comic-panel p-6">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Pricing</h3>
              <p className="text-gray-600">
                Get real-time market values for any grade. See raw vs slabbed prices at a glance.
              </p>
            </div>

            <div className="comic-panel p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Track Your Hunt</h3>
              <p className="text-gray-600">
                Build a list of books you&apos;re hunting for. Get notified when prices drop on your targets.
              </p>
            </div>
          </div>

          {/* How to Use */}
          <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How to Use Key Hunt</h2>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                  1
                </div>
                <p className="text-gray-700">Open Key Hunt on your phone</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                  2
                </div>
                <p className="text-gray-700">Scan a cover or enter manually</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                  3
                </div>
                <p className="text-gray-700">Select the condition grade</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                  4
                </div>
                <p className="text-gray-700">Get instant price data</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Access Key Hunt from your mobile device to start hunting!
            </p>
            <div className="inline-flex items-center gap-2 text-sm text-gray-500">
              <Smartphone className="w-4 h-4" />
              <span>Available on iOS and Android browsers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile UI - hidden on md+ screens */}
      <div className="md:hidden min-h-screen bg-gray-900 overflow-y-auto">
        {/* Offline Indicator */}
        {isOfflineMode && (
          <OfflineIndicator pendingCount={pendingActionsCount} syncResult={lastSyncResult} />
        )}

        {/* Header */}
        <div className="px-4 py-6 safe-area-inset-top border-b-4 border-black" style={{ background: "var(--pop-yellow)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black/10 rounded-full flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-black">Key Hunt</h1>
                <p className="text-sm text-black/70">Quick Price Lookup</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOfflineMode && (
                <button
                  onClick={() => setFlow("offline-search")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black/10 rounded-full text-black text-sm"
                >
                  <Database className="w-4 h-4" />
                  Cached
                </button>
              )}
              <button
                onClick={() => setFlow("history")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/10 rounded-full text-black text-sm"
              >
                <History className="w-4 h-4" />
                Recent
              </button>
            </div>
          </div>
        </div>

        {/* Offline Search View */}
        {flow === "offline-search" && (
          <div className="flex-1">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">Cached Lookups</h2>
                <button onClick={() => setFlow("options")} className="text-amber-400 text-sm">
                  Back
                </button>
              </div>
            </div>
            <KeyHuntOfflineSearch onSelectResult={handleSelectCachedResult} />
          </div>
        )}

        {/* History List View */}
        {flow === "history" && (
          <KeyHuntHistoryList
            onSelectEntry={handleSelectHistoryEntry}
            onClose={() => setFlow("options")}
          />
        )}

        {/* History Detail View */}
        {flow === "history-detail" && selectedHistoryEntry && (
          <KeyHuntHistoryDetail
            entry={selectedHistoryEntry}
            onClose={() => setFlow("history")}
            onLookupAgain={handleHistoryLookupAgain}
            onAddToCollection={handleAddFromHistory}
            isOffline={isOfflineMode}
          />
        )}

        {/* My Hunt List View */}
        {flow === "my-list" && (
          <div className="flex-1 bg-gray-50 min-h-[calc(100vh-120px)]">
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">My Hunt List</h2>
                <button
                  onClick={() => setFlow("options")}
                  className="text-amber-600 text-sm font-medium"
                >
                  Back
                </button>
              </div>
            </div>
            <div className="p-4">
              <KeyHuntWishlist onClose={() => setFlow("options")} />
            </div>
          </div>
        )}

        {/* Main content area for cover scan */}
        {flow === "cover-scan" && (
          <div className="p-4">
            <div className="text-center mb-4">
              <p className="text-lg font-medium text-gray-900">Take a photo of the cover</p>
              <p className="text-sm text-gray-600">
                We&apos;ll identify the comic and check if it&apos;s graded
              </p>
            </div>
            <ImageUpload onImageSelect={handleCoverImageSelect} disabled={false} />
            {/* Foil/shiny cover tip */}
            <p className="flex items-start gap-1.5 mt-3 text-xs text-gray-400">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>For foil, holographic, or shiny covers, photograph at a slight angle to reduce glare for best results.</span>
            </p>
            <button
              onClick={() => setFlow("options")}
              className="mt-4 w-full py-3 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Analyzing state */}
        {flow === "cover-analyzing" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-amber-400" />
              <p className="text-lg font-medium">Analyzing cover...</p>
              <p className="text-sm text-gray-400 mt-2">Identifying comic and checking for grade</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {flow === "loading" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-amber-400" />
              <p className="text-lg font-medium">Getting price...</p>
              <p className="text-sm text-gray-400 mt-2">
                {pendingComic?.title} #{pendingComic?.issueNumber}
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {flow === "error" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-lg font-medium text-white mb-2">Something went wrong</p>
              <p className="text-sm text-gray-400 mb-6">{error}</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleNewLookup}
                  className="px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors"
                >
                  Try Again
                </button>
                {isOfflineMode && (
                  <button
                    onClick={() => setFlow("offline-search")}
                    className="px-6 py-3 bg-gray-700 text-white rounded-xl font-medium hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    Search Cached Lookups
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Not signed in notice */}
        {!isSignedIn && flow === "options" && (
          <div className="p-4">
            <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-4 py-3">
              <p className="text-amber-200 text-sm text-center">
                Sign in to save comics to your collection
              </p>
            </div>
          </div>
        )}

        {/* Bottom Sheet - Options */}
        <KeyHuntBottomSheet
          isOpen={flow === "options"}
          onClose={handleClose}
          onSelectOption={handleSelectOption}
          isOffline={isOfflineMode}
        />

        {/* Manual Entry Modal */}
        <KeyHuntManualEntry
          isOpen={flow === "manual-entry"}
          onClose={() => setFlow("options")}
          onSubmit={handleManualSubmit}
        />

        {/* Grade Selector Modal */}
        <GradeSelector
          isOpen={flow === "grade-select"}
          onClose={() => setFlow("options")}
          onSelect={handleGradeSelect}
          comicTitle={pendingComic?.title}
          issueNumber={pendingComic?.issueNumber}
        />

        {/* Price Result */}
        {result && (
          <KeyHuntPriceResult
            isOpen={flow === "result"}
            onClose={handleNewLookup}
            onAddToCollection={handleAddToCollection}
            onAddToHuntList={
              isSignedIn
                ? async () => {
                    return addToKeyHunt({
                      title: result.title,
                      issueNumber: result.issueNumber,
                      publisher: result.publisher || undefined,
                      releaseYear: result.releaseYear || undefined,
                      coverImageUrl: result.coverImageUrl || undefined,
                      keyInfo: result.keyInfo,
                      currentPriceMid: result.averagePrice || undefined,
                      addedFrom: "key_hunt",
                    });
                  }
                : undefined
            }
            onNewLookup={handleNewLookup}
            title={result.title}
            issueNumber={result.issueNumber}
            grade={result.grade}
            averagePrice={result.averagePrice}
            recentSale={result.recentSale}
            coverImageUrl={result.coverImageUrl}
            gradeEstimates={result.gradeEstimates}
            isInHuntList={isInKeyHunt(result.title, result.issueNumber)}
            fromCache={result.fromCache}
            isOffline={isOfflineMode}
            source={result.source}
          />
        )}

        {/* Sync Notification */}
        {showSyncNotification && lastSyncResult && (
          <SyncNotification
            synced={lastSyncResult.synced}
            failed={lastSyncResult.failed}
            onDismiss={() => setShowSyncNotification(false)}
          />
        )}
      </div>
    </FeatureGate>
  );
}
