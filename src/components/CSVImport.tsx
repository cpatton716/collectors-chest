"use client";

import { useRef, useState } from "react";

import { AlertCircle, Check, Download, FileText, Loader2, Upload, X, Zap } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { parseCurrencyValue } from "@/lib/csvHelpers";
import { CollectionItem, ComicDetails, normalizePublisher } from "@/types/comic";

function parseBool(value: string): boolean {
  const v = value.toLowerCase().trim();
  return ["true", "1", "yes", "y"].includes(v);
}

interface CSVImportProps {
  onImportComplete: (items: CollectionItem[]) => void;
  onCancel: () => void;
}

interface ParsedRow {
  title: string;
  issueNumber: string;
  variant?: string;
  publisher?: string;
  writer?: string;
  coverArtist?: string;
  interiorArtist?: string;
  releaseYear?: string;
  isSlabbed?: boolean;
  gradingCompany?: string;
  grade?: string;
  isSignatureSeries?: boolean;
  signedBy?: string;
  condition?: string;
  purchasePrice?: number;
  purchaseDate?: string;
  notes?: string;
  forSale?: boolean;
  askingPrice?: number;
}

interface ImportResult {
  success: boolean;
  item?: CollectionItem;
  error?: string;
  row: ParsedRow;
}

const EXPECTED_HEADERS = [
  "title",
  "issueNumber",
  "variant",
  "publisher",
  "writer",
  "coverArtist",
  "interiorArtist",
  "releaseYear",
  "isSlabbed",
  "gradingCompany",
  "grade",
  "isSignatureSeries",
  "signedBy",
  "condition",
  "purchasePrice",
  "purchaseDate",
  "notes",
  "forSale",
  "askingPrice",
];

export function CSVImport({ onImportComplete, onCancel }: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [quickImport, setQuickImport] = useState(false);
  const [importedItems, setImportedItems] = useState<CollectionItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error(
        "Your CSV file appears to be empty. Please make sure it has a header row and at least one comic entry."
      );
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

    // Validate required headers
    if (!headers.includes("title") || !headers.includes("issuenumber")) {
      throw new Error(
        "Your CSV needs 'title' and 'issueNumber' columns. Download the sample template to see the correct format."
      );
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: ParsedRow = {
        title: "",
        issueNumber: "",
      };

      headers.forEach((header, idx) => {
        const value = values[idx]?.trim() || "";
        switch (header) {
          case "title":
            row.title = value;
            break;
          case "issuenumber":
            row.issueNumber = value;
            break;
          case "variant":
            row.variant = value || undefined;
            break;
          case "publisher":
            row.publisher = normalizePublisher(value) || undefined;
            break;
          case "writer":
            row.writer = value || undefined;
            break;
          case "coverartist":
            row.coverArtist = value || undefined;
            break;
          case "interiorartist":
            row.interiorArtist = value || undefined;
            break;
          case "releaseyear":
            row.releaseYear = value || undefined;
            break;
          case "isslabbed":
            row.isSlabbed = parseBool(value);
            break;
          case "gradingcompany":
            row.gradingCompany = value || undefined;
            break;
          case "grade":
            row.grade = value || undefined;
            break;
          case "issignatureseries":
            row.isSignatureSeries = parseBool(value);
            break;
          case "signedby":
            row.signedBy = value || undefined;
            break;
          case "condition":
            row.condition = value || undefined;
            break;
          case "purchaseprice":
            row.purchasePrice = parseCurrencyValue(value);
            break;
          case "purchasedate":
            row.purchaseDate = value || undefined;
            break;
          case "notes":
            row.notes = value || undefined;
            break;
          case "forsale":
            row.forSale = parseBool(value);
            break;
          case "askingprice":
            row.askingPrice = parseCurrencyValue(value);
            break;
        }
      });

      // Only add rows with required fields
      if (row.title && row.issueNumber) {
        rows.push(row);
      }
    }

    return rows;
  };

  // Parse a single CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setParseError(
        "Please select a CSV file. Other formats like Excel (.xlsx) aren't supported yet."
      );
      return;
    }

    setFile(selectedFile);
    setParseError("");

    try {
      const text = await selectedFile.text();
      const rows = parseCSV(text);
      setParsedRows(rows);
      setStep("preview");
    } catch (err) {
      setParseError(
        err instanceof Error
          ? err.message
          : "We couldn't read this CSV file. Please check the format and try again."
      );
    }
  };

  const handleImport = async () => {
    setStep("importing");
    setIsImporting(true);
    setImportProgress(0);

    const results: ImportResult[] = [];
    const successfulItems: CollectionItem[] = [];

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      setImportProgress(Math.round(((i + 1) / parsedRows.length) * 100));

      try {
        let priceData = null;
        let keyInfo: string[] = [];
        let enrichedWriter = row.writer || null;
        let enrichedCoverArtist = row.coverArtist || null;
        let enrichedInteriorArtist = row.interiorArtist || null;
        let enrichedPublisher = row.publisher || null;
        let enrichedReleaseYear = row.releaseYear || null;
        let enrichedCoverImageUrl = "";

        // Only call API for enrichment if Quick Import is disabled
        if (!quickImport) {
          const response = await fetch("/api/import-lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: row.title,
              issueNumber: row.issueNumber,
              variant: row.variant,
              publisher: row.publisher,
              releaseYear: row.releaseYear,
            }),
          });

          if (response.ok) {
            const lookupData = await response.json();
            priceData = lookupData.priceData || null;
            keyInfo = lookupData.keyInfo || [];
            // Use API data only if CSV didn't provide it
            enrichedWriter = row.writer || lookupData.writer || null;
            enrichedCoverArtist = row.coverArtist || lookupData.coverArtist || null;
            enrichedInteriorArtist = row.interiorArtist || lookupData.interiorArtist || null;
            enrichedPublisher = row.publisher || lookupData.publisher || null;
            enrichedReleaseYear = row.releaseYear || lookupData.releaseYear || null;
            enrichedCoverImageUrl = lookupData.coverImageUrl || "";
          }
        }

        // Create the comic details
        const comic: ComicDetails = {
          id: uuidv4(),
          title: row.title,
          issueNumber: row.issueNumber,
          variant: row.variant || null,
          publisher: enrichedPublisher,
          writer: enrichedWriter,
          coverArtist: enrichedCoverArtist,
          interiorArtist: enrichedInteriorArtist,
          releaseYear: enrichedReleaseYear,
          confidence: "high",
          isSlabbed: row.isSlabbed || false,
          gradingCompany: (row.gradingCompany as any) || null,
          grade: row.grade || null,
          isSignatureSeries: row.isSignatureSeries || false,
          signedBy: row.signedBy || null,
          priceData,
          keyInfo,
          certificationNumber: null,
          labelType: null,
          pageQuality: null,
          gradeDate: null,
          graderNotes: null,
        };

        // Determine list IDs based on slabbed status
        const listIds = row.isSlabbed ? ["collection", "slabbed"] : ["collection"];

        // Create collection item
        const item: CollectionItem = {
          id: uuidv4(),
          comic,
          coverImageUrl: enrichedCoverImageUrl,
          conditionGrade: row.grade ? parseFloat(row.grade) : null,
          conditionLabel: (row.condition as any) || null,
          isGraded: row.isSlabbed || false,
          gradingCompany: row.gradingCompany || null,
          purchasePrice: row.purchasePrice || null,
          purchaseDate: row.purchaseDate || null,
          notes: row.notes || null,
          forSale: row.forSale || false,
          forTrade: false,
          askingPrice: row.askingPrice || null,
          averagePrice: null,
          dateAdded: new Date().toISOString(),
          listIds,
          isStarred: false,
          customKeyInfo: [],
          customKeyInfoStatus: null,
        };

        successfulItems.push(item);
        results.push({ success: true, item, row });
      } catch (err) {
        results.push({
          success: false,
          error: err instanceof Error ? err.message : "Couldn't import this comic",
          row,
        });
      }

      // Small delay to prevent rate limiting (skip delay for quick import)
      if (!quickImport) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    setImportResults(results);
    setImportedItems(successfulItems);
    setIsImporting(false);
    setStep("complete");
  };

  const handleDone = () => {
    if (importedItems.length > 0) {
      onImportComplete(importedItems);
    }
    onCancel();
  };

  const successCount = importResults.filter((r) => r.success).length;
  const failCount = importResults.filter((r) => !r.success).length;

  return (
    <div className="bg-pop-white border-3 border-pop-black shadow-comic p-6">
      {/* Upload Step */}
      {step === "upload" && (
        <div>
          <h3 className="text-xl font-comic text-pop-black mb-4">IMPORT FROM CSV</h3>
          <p className="text-sm text-pop-black/70 mb-4">
            Upload a CSV file to bulk import your collection. Download the template below for the
            correct format.
          </p>
          <a
            href="/Collectors-Chest-Sample-Import.csv"
            download="Collectors-Chest-Sample-Import.csv"
            className="inline-flex items-center gap-2 text-sm text-pop-blue hover:text-pop-blue/80 font-comic mb-6"
          >
            <Download className="w-4 h-4" />
            Download sample CSV template
          </a>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-3 border-dashed border-pop-black/50 p-8 text-center cursor-pointer hover:border-pop-black hover:bg-pop-yellow/20 transition-colors"
          >
            <Upload className="w-12 h-12 text-pop-black/40 mx-auto mb-4" />
            <p className="text-pop-black/70 mb-2 font-comic">Click to select a CSV file</p>
            <p className="text-sm text-pop-black/50">or drag and drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {parseError && (
            <div className="mt-4 p-4 bg-pop-red/10 border-2 border-pop-red flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-pop-red flex-shrink-0 mt-0.5" />
              <p className="text-sm text-pop-red">{parseError}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 font-comic text-pop-black hover:bg-pop-black/10 border-2 border-pop-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === "preview" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h3 className="text-xl font-comic text-pop-black">PREVIEW IMPORT</h3>
            <div className="flex items-center gap-2 text-sm text-pop-black/60">
              <FileText className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{file?.name}</span>
            </div>
          </div>

          <p className="text-sm text-pop-black/70 mb-4">
            Found <strong className="text-pop-black">{parsedRows.length}</strong> comics to import.
            {!quickImport && " We'll look up price data, key info, and covers for each."}
            {quickImport && " Quick Import enabled - skipping data lookups for faster import."}
          </p>

          {/* Quick Import Toggle */}
          <div className="mb-6 p-4 bg-pop-yellow/20 border-2 border-pop-black">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <Zap className={`w-5 h-5 ${quickImport ? "text-pop-blue" : "text-pop-black/40"}`} />
                <div>
                  <span className="font-comic text-pop-black">Quick Import</span>
                  <p className="text-xs text-pop-black/60">
                    Skip price, creator, key info, and cover lookups for faster import
                  </p>
                </div>
              </div>
              <div
                className={`relative w-12 h-6 border-2 border-pop-black transition-colors overflow-hidden flex-shrink-0 ${
                  quickImport ? "bg-pop-yellow" : "bg-pop-white"
                }`}
                onClick={() => setQuickImport(!quickImport)}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-pop-black transition-transform ${
                    quickImport ? "left-auto right-0.5" : "left-0.5"
                  }`}
                />
              </div>
            </label>
          </div>

          <div className="max-h-64 overflow-y-auto border-2 border-pop-black mb-6 overflow-x-auto">
            <table className="w-full text-sm min-w-[280px]">
              <thead className="bg-pop-yellow sticky top-0">
                <tr>
                  <th className="text-left p-3 font-comic text-pop-black border-b-2 border-pop-black">Title</th>
                  <th className="text-left p-3 font-comic text-pop-black border-b-2 border-pop-black">Issue</th>
                  <th className="text-left p-3 font-comic text-pop-black border-b-2 border-pop-black hidden sm:table-cell">
                    Publisher
                  </th>
                  <th className="text-left p-3 font-comic text-pop-black border-b-2 border-pop-black hidden sm:table-cell">
                    Year
                  </th>
                </tr>
              </thead>
              <tbody className="bg-pop-white">
                {parsedRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="border-b border-pop-black/20">
                    <td className="p-3 text-pop-black">{row.title}</td>
                    <td className="p-3 text-pop-black/70">#{row.issueNumber}</td>
                    <td className="p-3 text-pop-black/70 hidden sm:table-cell">
                      {row.publisher || "-"}
                    </td>
                    <td className="p-3 text-pop-black/70 hidden sm:table-cell">
                      {row.releaseYear || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 50 && (
              <p className="p-3 text-sm text-pop-black/60 text-center bg-pop-yellow/30">
                ...and {parsedRows.length - 50} more
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setStep("upload");
                setFile(null);
                setParsedRows([]);
              }}
              className="px-4 py-2 font-comic text-pop-black hover:bg-pop-black/10 border-2 border-pop-black transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 font-comic bg-pop-blue text-pop-white border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Import {parsedRows.length} Comics
            </button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === "importing" && (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 text-pop-blue animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-comic text-pop-black mb-2">
            {quickImport ? "QUICK IMPORTING..." : "IMPORTING COMICS..."}
          </h3>
          <p className="text-sm text-pop-black/70 mb-4">
            {quickImport
              ? "Adding comics to your collection..."
              : "Looking up price data, key info, and covers for each comic..."}
          </p>
          <div className="w-full max-w-xs mx-auto bg-pop-black/20 h-3 border-2 border-pop-black mb-2">
            <div
              className="bg-pop-blue h-full transition-all"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-sm font-comic text-pop-black/60">{importProgress}% complete</p>
        </div>
      )}

      {/* Complete Step */}
      {step === "complete" && (
        <div>
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-pop-green border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-pop-white" />
            </div>
            <h3 className="text-xl font-comic text-pop-black mb-2">IMPORT COMPLETE!</h3>
            <p className="text-pop-black/70">
              Successfully imported <strong className="text-pop-black">{successCount}</strong> of {parsedRows.length} comics.
            </p>
            {successCount > 0 && (
              <div className="mt-4 p-3 bg-pop-blue/10 border-2 border-pop-blue text-left max-w-md mx-auto">
                <p className="text-sm text-pop-black font-comic mb-1">COVER TIP:</p>
                <p className="text-sm text-pop-black/70">
                  {quickImport
                    ? "Quick Import skips cover lookups. Tap any comic and use the Edit button to add or change the cover image."
                    : "Some covers may not match perfectly. Tap any comic and use the Edit button to change the cover image."}
                </p>
              </div>
            )}
          </div>

          {failCount > 0 && (
            <div className="mt-4 p-4 bg-pop-yellow/30 border-2 border-pop-black">
              <p className="text-sm text-pop-black font-comic mb-2">
                {failCount} {failCount === 1 ? "comic" : "comics"} couldn&apos;t be imported:
              </p>
              <ul className="text-sm text-pop-black/70 space-y-1">
                {importResults
                  .filter((r) => !r.success)
                  .slice(0, 5)
                  .map((r, idx) => (
                    <li key={idx}>
                      {r.row.title} #{r.row.issueNumber}: {r.error}
                    </li>
                  ))}
                {failCount > 5 && <li>...and {failCount - 5} more</li>}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleDone}
              className="px-6 py-2 font-comic bg-pop-green text-pop-white border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
