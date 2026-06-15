"use client";

import { useState } from "react";

import { useUser } from "@clerk/nextjs";

import { CheckCircle, CloudUpload, Loader2, Trash2, XCircle } from "lucide-react";

import { useModalA11y } from "@/hooks/useModalA11y";
import { getOrCreateProfile, migrateLocalDataToCloud } from "@/lib/db";
import { storage } from "@/lib/storage";

interface DataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function DataMigrationModal({ isOpen, onClose, onComplete }: DataMigrationModalProps) {
  const { user } = useUser();
  const [status, setStatus] = useState<"idle" | "migrating" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const { dialogProps } = useModalA11y({ isOpen, onClose, label: "Account data migration" });

  // Get local data counts
  const localComics = storage.getCollection();
  const localLists = storage.getLists().filter((l) => !l.isDefault);
  const localSales = storage.getSales();

  const hasLocalData = localComics.length > 0 || localLists.length > 0 || localSales.length > 0;

  const handleMigrate = async () => {
    if (!user) return;

    setStatus("migrating");
    setErrorMessage("");

    try {
      // Get or create profile for this user
      const profile = await getOrCreateProfile(user.id, user.primaryEmailAddress?.emailAddress);

      // Migrate all local data
      await migrateLocalDataToCloud(profile.id, localComics, storage.getLists(), localSales);

      // Clear local storage after successful migration
      localStorage.removeItem("comic_collection");
      localStorage.removeItem("comic_lists");
      localStorage.removeItem("comic_sales");
      localStorage.removeItem("comic_guest_scans");

      setStatus("success");
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      console.error("Migration error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "We couldn't import your data right now. Your local data is still safe - please try again."
      );
      setStatus("error");
    }
  };

  const handleStartFresh = () => {
    // Clear local storage
    localStorage.removeItem("comic_collection");
    localStorage.removeItem("comic_lists");
    localStorage.removeItem("comic_sales");
    localStorage.removeItem("comic_guest_scans");
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div {...dialogProps} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl outline-none">
        {status === "idle" && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to Your Account!</h2>

            {hasLocalData ? (
              <>
                <p className="text-gray-600 mb-4">
                  We found existing data on this device. Would you like to import it to your new
                  account?
                </p>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-gray-900 mb-2">Found on this device:</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {localComics.length > 0 && (
                      <li>
                        • {localComics.length} comic{localComics.length !== 1 ? "s" : ""}
                      </li>
                    )}
                    {localLists.length > 0 && (
                      <li>
                        • {localLists.length} custom list{localLists.length !== 1 ? "s" : ""}
                      </li>
                    )}
                    {localSales.length > 0 && (
                      <li>
                        • {localSales.length} sale record{localSales.length !== 1 ? "s" : ""}
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={handleMigrate}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    <CloudUpload className="w-5 h-5" />
                    Import to My Account
                  </button>
                  <button
                    onClick={handleStartFresh}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    Start Fresh (Delete Local Data)
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  Your account is ready! Start scanning comics to build your collection.
                </p>
                <button
                  onClick={onComplete}
                  className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Get Started
                </button>
              </>
            )}
          </>
        )}

        {status === "migrating" && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 mt-4">
              Importing Your Collection...
            </h3>
            <p className="text-gray-600 mt-2">This may take a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 mt-4">Import Complete!</h3>
            <p className="text-gray-600 mt-2">Your collection has been saved to the cloud.</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 mt-4">Couldn&apos;t Import Data</h3>
            <p className="text-gray-600 mt-2">{errorMessage}</p>
            <div className="mt-6 space-y-2">
              <button
                onClick={handleMigrate}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Skip for Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
