"use client";

import { useRef, useState } from "react";

import { AlertCircle, Check, Download, FileText, Loader2, Upload, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { CollectionItem, ComicDetails } from "@/types/comic";

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
            row.publisher = value || undefined;
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
            row.isSlabbed = value.toLowerCase() === "true" || value === "1";
            break;
          case "gradingcompany":
            row.gradingCompany = value || undefined;
            break;
          case "grade":
            row.grade = value || undefined;
            break;
          case "issignatureseries":
            row.isSignatureSeries = value.toLowerCase() === "true" || value === "1";
            break;
          case "signedby":
            row.signedBy = value || undefined;
            break;
          case "condition":
            row.condition = value || undefined;
            break;
          case "purchaseprice":
            row.purchasePrice = value ? parseFloat(value) : undefined;
            break;
          case "purchasedate":
            row.purchaseDate = value || undefined;
            break;
          case "notes":
            row.notes = value || undefined;
            break;
          case "forsale":
            row.forSale = value.toLowerCase() === "true" || value === "1";
            break;
          case "askingprice":
            row.askingPrice = value ? parseFloat(value) : undefined;
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
        // Call API to lookup price data and key info
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

        let priceData = null;
        let keyInfo: string[] = [];
        let enrichedWriter = row.writer || null;
        let enrichedCoverArtist = row.coverArtist || null;
        let enrichedInteriorArtist = row.interiorArtist || null;
        let enrichedPublisher = row.publisher || null;
        let enrichedReleaseYear = row.releaseYear || null;
        let enrichedCoverImageUrl = "";

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

      // Small delay to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    setImportResults(results);
    setIsImporting(false);
    setStep("complete");

    if (successfulItems.length > 0) {
      onImportComplete(successfulItems);
    }
  };

  const successCount = importResults.filter((r) => r.success).length;
  const failCount = importResults.filter((r) => !r.success).length;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Upload Step */}
      {step === "upload" && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Import from CSV</h3>
          <p className="text-sm text-gray-600 mb-4">
            Upload a CSV file to bulk import your collection. Download the template below for the
            correct format.
          </p>
          <a
            href="/sample-import.csv"
            download="sample-import.csv"
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium mb-6"
          >
            <Download className="w-4 h-4" />
            Download sample CSV template
          </a>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Click to select a CSV file</p>
            <p className="text-sm text-gray-400">or drag and drop</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {parseError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{parseError}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
            <h3 className="text-lg font-semibold text-gray-900">Preview Import</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              <span className="truncate max-w-[200px]">{file?.name}</span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Found <strong>{parsedRows.length}</strong> comics to import. We&apos;ll look up price
            data and key info for each.
          </p>

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg mb-6 overflow-x-auto">
            <table className="w-full text-sm min-w-[280px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">Title</th>
                  <th className="text-left p-3 font-medium text-gray-700">Issue</th>
                  <th className="text-left p-3 font-medium text-gray-700 hidden sm:table-cell">
                    Publisher
                  </th>
                  <th className="text-left p-3 font-medium text-gray-700 hidden sm:table-cell">
                    Year
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="p-3 text-gray-900">{row.title}</td>
                    <td className="p-3 text-gray-600">#{row.issueNumber}</td>
                    <td className="p-3 text-gray-600 hidden sm:table-cell">
                      {row.publisher || "-"}
                    </td>
                    <td className="p-3 text-gray-600 hidden sm:table-cell">
                      {row.releaseYear || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 50 && (
              <p className="p-3 text-sm text-gray-500 text-center bg-gray-50">
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
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Import {parsedRows.length} Comics
            </button>
          </div>
        </div>
      )}

      {/* Importing Step */}
      {step === "importing" && (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Importing Comics</h3>
          <p className="text-sm text-gray-600 mb-4">
            Looking up price data and key info for each comic...
          </p>
          <div className="w-full max-w-xs mx-auto bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">{importProgress}% complete</p>
        </div>
      )}

      {/* Complete Step */}
      {step === "complete" && (
        <div>
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Complete</h3>
            <p className="text-gray-600">
              Successfully imported <strong>{successCount}</strong> of {parsedRows.length} comics.
            </p>
          </div>

          {failCount > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium mb-2">
                {failCount} {failCount === 1 ? "comic" : "comics"} couldn&apos;t be imported:
              </p>
              <ul className="text-sm text-yellow-700 space-y-1">
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
              onClick={onCancel}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
