import { CollectionItem } from "@/types/comic";

/**
 * Escapes a value for CSV format
 * - Wraps in quotes if contains comma, quote, or newline
 * - Doubles any quotes within the value
 */
function escapeCSVValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // Check if value needs quoting (contains comma, quote, or newline)
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Converts a collection of items to CSV format
 */
export function collectionToCSV(items: CollectionItem[]): string {
  // Define headers
  const headers = [
    "Title",
    "Issue Number",
    "Variant",
    "Publisher",
    "Release Year",
    "Writer",
    "Cover Artist",
    "Interior Artist",
    "Condition Grade",
    "Condition Label",
    "Is Graded",
    "Grading Company",
    "Grade",
    "Purchase Price",
    "Purchase Date",
    "Avg List Price",
    "For Sale",
    "Asking Price",
    "Notes",
    "Key Info",
    "Date Added",
    "Cover Image URL",
  ];

  // Create header row
  const rows: string[] = [headers.join(",")];

  // Add data rows
  for (const item of items) {
    const { comic } = item;

    const row = [
      escapeCSVValue(comic.title),
      escapeCSVValue(comic.issueNumber),
      escapeCSVValue(comic.variant),
      escapeCSVValue(comic.publisher),
      escapeCSVValue(comic.releaseYear),
      escapeCSVValue(comic.writer),
      escapeCSVValue(comic.coverArtist),
      escapeCSVValue(comic.interiorArtist),
      escapeCSVValue(item.conditionGrade),
      escapeCSVValue(item.conditionLabel),
      escapeCSVValue(item.isGraded),
      escapeCSVValue(item.gradingCompany),
      escapeCSVValue(comic.grade),
      escapeCSVValue(item.purchasePrice),
      escapeCSVValue(item.purchaseDate),
      escapeCSVValue(comic.priceData?.estimatedValue),
      escapeCSVValue(item.forSale),
      escapeCSVValue(item.askingPrice),
      escapeCSVValue(item.notes),
      escapeCSVValue(comic.keyInfo?.join(", ")),
      escapeCSVValue(item.dateAdded),
      escapeCSVValue(item.coverImageUrl?.startsWith("data:") ? "" : item.coverImageUrl),
    ];

    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Triggers a browser download of the CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create a Blob with the CSV content
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  // Create a download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Generates the export filename with current date
 */
export function generateExportFilename(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `collectors-chest-export-${year}-${month}-${day}.csv`;
}

/**
 * Exports collection items to a CSV file and triggers download
 */
export function exportCollectionToCSV(items: CollectionItem[]): void {
  const csvContent = collectionToCSV(items);
  const filename = generateExportFilename();
  downloadCSV(csvContent, filename);
}
