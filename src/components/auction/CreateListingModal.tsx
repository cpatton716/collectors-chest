"use client";

import { useState } from "react";

import Image from "next/image";

import { AlertCircle, Camera, Check, DollarSign, Package, Tag, X } from "lucide-react";

import { MAX_DETAIL_IMAGES, MIN_FIXED_PRICE } from "@/types/auction";
import { CollectionItem } from "@/types/comic";
import { isAgeVerificationError } from "@/lib/ageVerification";

import AgeVerificationModal from "@/components/AgeVerificationModal";
import { ComicImage } from "../ComicImage";

interface CreateListingModalProps {
  comic: CollectionItem;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (listingId: string) => void;
}

export function CreateListingModal({ comic, isOpen, onClose, onCreated }: CreateListingModalProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [price, setPrice] = useState<string>("");
  const [shippingCost, setShippingCost] = useState<string>("5");
  const [description, setDescription] = useState<string>("");
  const [detailImages, setDetailImages] = useState<string[]>([]);
  const [showAgeGate, setShowAgeGate] = useState(false);

  const totalSteps = 2;

  const validateStep1 = (): boolean => {
    const listingPrice = parseFloat(price);

    if (isNaN(listingPrice) || listingPrice < MIN_FIXED_PRICE) {
      setError(`Price must be at least $${MIN_FIXED_PRICE}`);
      return false;
    }

    const shipping = parseFloat(shippingCost);
    if (isNaN(shipping) || shipping < 0) {
      setError("Please enter a valid shipping cost");
      return false;
    }

    setError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comicId: comic.id,
          listingType: "fixed_price",
          price: parseFloat(price),
          shippingCost: parseFloat(shippingCost),
          description,
          detailImages,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onCreated?.(data.auction.id);
        onClose();
      } else {
        if (isAgeVerificationError(data)) {
          setShowAgeGate(true);
          return;
        }
        setError(data.error || "Failed to create listing");
      }
    } catch (err) {
      setError("Failed to create listing. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_DETAIL_IMAGES - detailImages.length;
    const filesToProcess = Array.from(files).slice(0, remaining);

    for (const file of filesToProcess) {
      const reader = new FileReader();
      reader.onload = () => {
        setDetailImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setDetailImages((prev) => prev.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Create Listing</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 px-4 pt-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1 rounded-full ${s <= step ? "bg-green-500" : "bg-gray-200"}`}
              />
            ))}
          </div>

          {/* Comic Preview */}
          <div className="flex items-center gap-3 p-4 m-4 bg-gray-50 rounded-lg">
            <div className="w-16 h-24 rounded overflow-hidden flex-shrink-0">
              <ComicImage
                src={comic.coverImageUrl}
                alt={comic.comic.title || "Comic"}
                aspectRatio="fill"
                sizes="64px"
              />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {comic.comic.title || "Unknown Title"} #{comic.comic.issueNumber || "?"}
              </h3>
              <p className="text-sm text-gray-600">
                {comic.comic.publisher || "Unknown Publisher"}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Step 1: Pricing & Shipping */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Set Your Price</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      min={MIN_FIXED_PRICE}
                      step="1"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Minimum: ${MIN_FIXED_PRICE}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shipping Cost
                  </label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900"
                      placeholder="5.00"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Set to 0 for free shipping</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none bg-white text-gray-900"
                    placeholder="Describe the condition, any defects, or special features..."
                  />
                </div>
              </div>
            )}

            {/* Step 2: Photos & Review */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Additional Photos (Optional)</h3>
                <p className="text-sm text-gray-600">
                  Add up to {MAX_DETAIL_IMAGES} detail photos showing condition, spine, back cover,
                  etc.
                </p>

                {/* Image Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {detailImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square">
                      <Image
                        src={img}
                        alt={`Detail ${idx + 1}`}
                        fill
                        className="object-cover rounded-lg"
                        sizes="80px"
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {detailImages.length < MAX_DETAIL_IMAGES && (
                    <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                      <Camera className="w-6 h-6 text-gray-400" />
                      <span className="text-xs text-gray-500 mt-1">Add</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Summary */}
                <div className="mt-6 p-4 bg-green-50 rounded-lg space-y-2">
                  <h4 className="font-medium text-green-900">Listing Summary</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-green-700">Price:</span>
                      <span className="font-medium text-green-900">${price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-700">Shipping:</span>
                      <span className="font-medium text-green-900">
                        {parseFloat(shippingCost) === 0 ? "Free" : `$${shippingCost}`}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-green-200">
                      <span className="text-green-700 font-medium">Total for buyer:</span>
                      <span className="font-bold text-green-900">
                        ${(parseFloat(price || "0") + parseFloat(shippingCost || "0")).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t">
            <button
              onClick={step === 1 ? onClose : handleBack}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>

            {step < totalSteps ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  "Creating..."
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Listing
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {showAgeGate && (
        <AgeVerificationModal
          action="list an item for sale"
          onVerified={() => {
            setShowAgeGate(false);
            handleSubmit();
          }}
          onDismiss={() => setShowAgeGate(false)}
        />
      )}
    </div>
  );
}
