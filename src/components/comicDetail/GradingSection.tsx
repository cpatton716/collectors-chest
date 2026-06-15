"use client";

import { ExternalLink, Loader2, Search } from "lucide-react";

import {
  ComicDetails,
  GRADE_SCALE,
  GRADING_COMPANIES,
  GradingCompany,
} from "@/types/comic";

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

interface GradingSectionProps {
  comic: ComicDetails;
  isGraded: boolean;
  gradingCompany: GradingCompany | "";
  grade: string;
  certificationNumber: string;
  isLookingUpCert: boolean;
  onIsGradedChange: (value: boolean) => void;
  onGradingCompanyChange: (value: GradingCompany | "") => void;
  onGradeChange: (value: string) => void;
  onCertificationNumberChange: (value: string) => void;
  onCertLookup: () => void;
}

/**
 * Grading field group extracted from ComicDetailsForm (R3 / M-CO15).
 * Presentational; markup verbatim. Parent owns all grading state + the cert
 * lookup handler.
 */
export function GradingSection({
  comic,
  isGraded,
  gradingCompany,
  grade,
  certificationNumber,
  isLookingUpCert,
  onIsGradedChange,
  onGradingCompanyChange,
  onGradeChange,
  onCertificationNumberChange,
  onCertLookup,
}: GradingSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Grading</h3>

      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isGraded}
            onChange={(e) => onIsGradedChange(e.target.checked)}
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
              <label
                htmlFor="cdf-grading-company"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Grading Company
              </label>
              <select
                id="cdf-grading-company"
                value={gradingCompany}
                onChange={(e) => onGradingCompanyChange(e.target.value as GradingCompany | "")}
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
              <label htmlFor="cdf-grade" className="block text-sm font-medium text-gray-700 mb-1">
                Grade
              </label>
              <select
                id="cdf-grade"
                value={grade}
                onChange={(e) => onGradeChange(e.target.value)}
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
            <label htmlFor="cdf-cert-number" className="block text-sm font-medium text-gray-700 mb-1">
              Certification Number
            </label>
            <div className="flex gap-2">
              <input
                id="cdf-cert-number"
                type="text"
                value={certificationNumber}
                onChange={(e) => onCertificationNumberChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
                placeholder="e.g., 3904837001"
              />
              <button
                type="button"
                onClick={onCertLookup}
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Grade Date</label>
                  <p className="text-sm text-slate-700">{comic.gradeDate}</p>
                </div>
              )}

              {/* Grader Notes */}
              {comic.graderNotes && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Grader Notes
                  </label>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{comic.graderNotes}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
