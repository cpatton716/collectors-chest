"use client";

import { Suspense, useEffect, useState } from "react";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  ClipboardCheck,
  FileSpreadsheet,
  Loader2,
  PenLine,
  Save,
  ScanBarcode,
  Sparkles,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { StorageQuotaError, storage } from "@/lib/storage";

import { useCollection } from "@/hooks/useCollection";
import { MilestoneType, useGuestScans } from "@/hooks/useGuestScans";

import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CSVImport } from "@/components/CSVImport";
import { ComicDetailsForm } from "@/components/ComicDetailsForm";
import { GuestLimitBanner } from "@/components/GuestLimitBanner";
import { ImageUpload } from "@/components/ImageUpload";
import { analytics } from "@/components/PostHogProvider";
import { SignUpPromptModal } from "@/components/SignUpPromptModal";
import { useToast } from "@/components/Toast";

import { CollectionItem, ComicDetails } from "@/types/comic";

// Component that handles bonus scan verification from URL params
// Must be wrapped in Suspense because it uses useSearchParams
function BonusVerificationHandler({
  addBonusScans,
  showToast,
}: {
  addBonusScans: () => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const bonusStatus = searchParams.get("bonus_status");
    const bonusMessage = searchParams.get("bonus_message");
    const bonusGranted = searchParams.get("bonus_granted");

    if (bonusStatus && bonusMessage) {
      // Show appropriate toast based on status
      if (bonusStatus === "success" && bonusGranted === "true") {
        addBonusScans();
        showToast(bonusMessage, "success");
      } else if (bonusStatus === "already_verified") {
        showToast(bonusMessage, "info");
      } else if (bonusStatus === "expired" || bonusStatus === "error") {
        showToast(bonusMessage, "error");
      }

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete("bonus_status");
      url.searchParams.delete("bonus_message");
      url.searchParams.delete("bonus_granted");
      router.replace(url.pathname, { scroll: false });
    }
  }, [searchParams, addBonusScans, showToast, router]);

  return null; // This component just handles the side effect
}

type ScanState = "upload" | "analyzing" | "review" | "saved" | "error";

const COMIC_FACTS = [
  "Superman's first appearance in Action Comics #1 (1938) sold for $3.2 million in 2014.",
  "Wolverine was originally intended to be an actual wolverine mutated into human form.",
  "Before becoming Iron Man, Tony Stark's original armor was gray, not red and gold.",
  "Spider-Man was rejected by Marvel at first because Stan Lee's publisher thought readers hated spiders.",
  "The first comic book ever published was 'Famous Funnies' in 1933.",
  "Batman was originally going to be called 'Bird-Man' before Bob Kane changed his mind.",
  "Deadpool's real name, Wade Wilson, is a parody of DC's Deathstroke (Slade Wilson).",
  "The X-Men were originally called 'The Merry Mutants' during early development.",
  "Captain America's shield is made of vibranium, the same metal as Black Panther's suit.",
  "Venom was originally designed as a female character before becoming Eddie Brock.",
  "The Joker was almost cut after his first appearance because he was considered too evil.",
  "Wonder Woman was created by the same psychologist who invented the lie detector test.",
  "Hawkeye and Green Arrow debuted the same year (1941) for rival publishers.",
  "The first Black superhero in mainstream comics was Black Panther in 1966.",
  "Ghost Rider was originally going to be called 'Ghost Racer' and ride a horse.",
  "Stan Lee made cameos in Marvel films as a tribute to his co-creation of many characters.",
  "The Hulk was originally gray, but printing issues led Marvel to change him to green.",
  "Wolverine's claws were originally supposed to be part of his gloves, not his body.",
  "Thor's hammer Mjolnir is inscribed: 'Whosoever holds this hammer, if he be worthy...'",
  "The Flash can run faster than the speed of light and has even outrun death itself.",
  "Aquaman can control all sea life because he's telepathic, not because he 'talks to fish.'",
  "The Fantastic Four were Marvel's first superhero team, debuting in 1961.",
  "Robin's original costume was inspired by the legendary Robin Hood.",
  "Magneto and Professor X were inspired by Malcolm X and Martin Luther King Jr.",
  "The rarest comic is Action Comics #1, with fewer than 100 copies known to exist.",
  "Spawn's cape is actually alive and can respond to his thoughts.",
  "Harley Quinn was created for Batman: The Animated Series, not the comics.",
  "The Punisher's skull logo has been worn by military and police units worldwide.",
  "Teenage Mutant Ninja Turtles started as a parody of popular comics like Daredevil.",
  "Thanos was inspired by the DC villain Darkseid and the Freudian concept of Thanatos.",
  // Additional facts
  "Nick Fury was originally white in the comics; the Samuel L. Jackson version was from the Ultimate universe.",
  "The Comics Code Authority banned vampires, werewolves, and zombies from comics for nearly 20 years.",
  "Blade first appeared as a supporting character in Tomb of Dracula #10 (1973).",
  "Ms. Marvel (Kamala Khan) was the first Muslim character to headline a Marvel comic.",
  "Superman once arm-wrestled Muhammad Ali in a 1978 DC comic special.",
  "The term 'graphic novel' was popularized by Will Eisner's 'A Contract with God' in 1978.",
  "Squirrel Girl has canonically defeated Thanos, Doctor Doom, and Galactus.",
  "The first comic book to sell for over $1 million was a CGC 8.0 copy of Action Comics #1 in 2010.",
  "Kitty Pryde of the X-Men was only 13 years old when she first joined the team.",
  "Iron Man's Extremis armor was the first to be stored inside Tony Stark's body.",
  "The Infinity Gauntlet storyline killed half of all life in the universe—including most Avengers.",
  "Ant-Man can shrink to the subatomic level and enter the Quantum Realm.",
  "DC's Lobo was created as a parody of violent comic book antiheroes like Wolverine.",
  "The original Human Torch was an android, not Johnny Storm of the Fantastic Four.",
  "Rocket Raccoon first appeared in Marvel Preview #7 (1976), years before Guardians of the Galaxy.",
  "Jean Grey has died and been resurrected more times than any other X-Men character.",
  "The Sandman by Neil Gaiman won a World Fantasy Award—the first comic to do so.",
  "Batman has a contingency plan to defeat every member of the Justice League.",
  "Daredevil's radar sense lets him 'see' better than most sighted people.",
  "The original Captain Marvel (Shazam) once outsold Superman in the 1940s.",
  "Cable is the son of Cyclops and a clone of Jean Grey named Madelyne Pryor.",
  "Howard the Duck ran for President of the United States in his 1976 comic series.",
  "The Green Lantern oath was written by Alfred Bester, a famous science fiction author.",
  "Galactus was originally drawn as a god-like figure, not a man in purple armor.",
  "Miles Morales was co-created by Brian Michael Bendis and artist Sara Pichelli in 2011.",
  "The Death of Superman in 1992 sold over 6 million copies.",
  "Watchmen was originally going to use characters DC acquired from Charlton Comics.",
  "John Constantine (Hellblazer) was designed to look like the musician Sting.",
  "Captain America was punching Hitler on the cover of his first comic in March 1941—before the US entered WWII.",
  "The Batcave was invented for the 1943 Batman movie serial, then added to comics.",
  "X-23 (Laura Kinney) was created for the X-Men: Evolution animated series before appearing in comics.",
  "Poison Ivy was originally a one-off Batman villain in 1966 before becoming iconic.",
  "The Superman 'S' symbol means 'hope' on Krypton.",
  "Moon Knight has multiple personalities: Marc Spector, Steven Grant, and Jake Lockley.",
  "Red Skull's face is not a mask—it's his actual face after a botched super-soldier serum.",
  "Gwenpool started as a joke variant cover before getting her own comic series.",
  "The Teen Titans were originally called the 'Junior Justice League' in early concepts.",
  "Doctor Strange was a greedy surgeon before a car accident led him to the mystic arts.",
  "Groot's vocabulary is limited because his species' vocal cords harden as they age.",
  "Black Widow was originally introduced as an Iron Man villain in 1964.",
  "Nightcrawler's father is the demon Azazel, making him part-demon.",
  "The Joker's real name and origin have never been definitively confirmed in comics.",
  "Martian Manhunter is considered one of the most powerful Justice League members.",
  "Emma Frost started as a villain (the White Queen) before joining the X-Men.",
  "The Batman Who Laughs is a version of Batman infected with Joker toxin.",
  "Rogue permanently absorbed Ms. Marvel's powers after holding on too long.",
  "Storm was worshipped as a goddess in Kenya before joining the X-Men.",
  "Frank Miller's The Dark Knight Returns (1986) redefined Batman as a darker character.",
  "The Savage Dragon by Erik Larsen has been continuously written and drawn by him since 1992.",
  "Kryptonite was invented for the Superman radio show so the voice actor could take vacations.",
  "Jessica Jones was originally going to be named Jessica Drew (Spider-Woman's name).",
];

const STEPS = [
  { id: "upload", label: "Upload", icon: Camera },
  { id: "analyzing", label: "Analysis", icon: Sparkles },
  { id: "review", label: "Review", icon: ClipboardCheck },
  { id: "saved", label: "Saved", icon: Save },
];

export default function ScanPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { showToast } = useToast();
  const { isLimitReached, isGuest, incrementScan, count, markMilestoneShown, addBonusScans } =
    useGuestScans();
  const { addToCollection } = useCollection();
  const [state, setState] = useState<ScanState>("upload");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [comicDetails, setComicDetails] = useState<ComicDetails | null>(null);
  const [error, setError] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedComic, setSavedComic] = useState<CollectionItem | null>(null);
  const [currentFact, setCurrentFact] = useState("");
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isProcessingBarcode, setIsProcessingBarcode] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [milestoneToShow, setMilestoneToShow] = useState<MilestoneType>(null);
  const [showEnlargedImage, setShowEnlargedImage] = useState(false);

  // Rotate fun facts every 7 seconds during analyzing state
  useEffect(() => {
    if (state === "analyzing") {
      const getRandomFact = () => COMIC_FACTS[Math.floor(Math.random() * COMIC_FACTS.length)];
      setCurrentFact(getRandomFact());

      const interval = setInterval(() => {
        setCurrentFact(getRandomFact());
      }, 7000);

      return () => clearInterval(interval);
    }
  }, [state]);

  const handleImageSelect = async (file: File, preview: string) => {
    setImagePreview(preview);
    setState("analyzing");
    setError("");

    try {
      // Get the media type from the file
      const mediaType = file.type || "image/jpeg";

      // Send to our API for Claude Vision analysis
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: preview,
          mediaType,
        }),
      });

      if (!response.ok) {
        // Handle non-JSON error responses (like edge function timeouts)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to analyze image");
        } else {
          // Edge function timeout or other non-JSON error
          const errorText = await response.text();
          console.error("Non-JSON error response:", errorText);
          if (
            response.status === 504 ||
            errorText.includes("edge") ||
            errorText.includes("timeout")
          ) {
            throw new Error(
              "The image took too long to process. Please try a smaller image or take a new photo."
            );
          }
          throw new Error("Something went wrong. Please try again with a different image.");
        }
      }

      const details = await response.json();

      // Add an ID to the comic details
      const comicWithId = {
        ...details,
        id: uuidv4(),
      };
      setComicDetails(comicWithId);
      setState("review");

      // Track successful scan
      analytics.trackScan("upload", true);
    } catch (err) {
      console.error("Error analyzing comic:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't recognize this comic. Please try a clearer photo or enter the details manually."
      );
      setState("error");

      // Track failed scan
      analytics.trackScan("upload", false);
    }
  };

  const handleSave = async (itemData: Partial<CollectionItem>) => {
    setIsSaving(true);

    try {
      // Determine if this is a slabbed/graded comic
      const isSlabbed = itemData.isGraded || itemData.comic?.isSlabbed || comicDetails?.isSlabbed;
      const listIds = isSlabbed ? ["collection", "slabbed"] : ["collection"];

      const newItem: CollectionItem = {
        id: uuidv4(),
        comic: itemData.comic || comicDetails!,
        coverImageUrl: imagePreview,
        conditionGrade: itemData.conditionGrade || null,
        conditionLabel: itemData.conditionLabel || null,
        isGraded: itemData.isGraded || false,
        gradingCompany: itemData.gradingCompany || null,
        purchasePrice: itemData.purchasePrice || null,
        purchaseDate: itemData.purchaseDate || null,
        notes: itemData.notes || null,
        forSale: itemData.forSale || false,
        forTrade: itemData.forTrade || false,
        askingPrice: itemData.askingPrice || null,
        averagePrice: null, // Would come from price API in production
        dateAdded: new Date().toISOString(),
        listIds,
        isStarred: false,
        customKeyInfo: itemData.customKeyInfo || [],
        customKeyInfoStatus: itemData.customKeyInfoStatus || null,
      };

      await addToCollection(newItem);
      setSavedComic(newItem);
      setState("saved");

      // Increment guest scan count and check for milestones
      const milestone = incrementScan();
      if (milestone) {
        // Show milestone modal after a brief delay to let the success state render
        setTimeout(() => {
          setMilestoneToShow(milestone);
        }, 500);
      }

      showToast(`"${newItem.comic.title}" added to collection!`, "success");

      // Track comic added to collection
      analytics.trackAddToCollection(newItem.comic.title || "Unknown", listIds[0]);
    } catch (err) {
      console.error("Error saving comic:", err);
      if (err instanceof StorageQuotaError) {
        setError(err.message);
        showToast("Storage is full. Sign in to save to the cloud.", "error");
      } else {
        setError("We couldn't save this comic right now. Please try again.");
        showToast("Couldn't save comic. Please try again.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAnother = () => {
    setState("upload");
    setImagePreview("");
    setComicDetails(null);
    setSavedComic(null);
    setError("");
  };

  const handleCancel = () => {
    setState("upload");
    setImagePreview("");
    setComicDetails(null);
    setError("");
  };

  const handleManualEntry = () => {
    // Create empty comic details for manual entry
    setComicDetails({
      id: uuidv4(),
      title: null,
      issueNumber: null,
      variant: null,
      publisher: null,
      coverArtist: null,
      writer: null,
      interiorArtist: null,
      releaseYear: null,
      confidence: "low",
      isSlabbed: false,
      gradingCompany: null,
      grade: null,
      isSignatureSeries: false,
      signedBy: null,
      priceData: null,
      keyInfo: [],
      certificationNumber: null,
      labelType: null,
      pageQuality: null,
      gradeDate: null,
      graderNotes: null,
    });
    setState("review");
  };

  const handleBarcodeScan = async (barcode: string) => {
    setIsProcessingBarcode(true);

    try {
      const response = await fetch("/api/barcode-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to look up comic");
      }

      // Set the cover image if provided
      if (data.coverImageUrl) {
        setImagePreview(data.coverImageUrl);
      }

      // Set comic details
      setComicDetails({
        id: uuidv4(),
        title: data.title,
        issueNumber: data.issueNumber,
        variant: data.variant,
        publisher: data.publisher,
        coverArtist: data.coverArtist,
        writer: data.writer,
        interiorArtist: data.interiorArtist,
        releaseYear: data.releaseYear,
        confidence: data.confidence || "high",
        isSlabbed: false,
        gradingCompany: null,
        grade: null,
        isSignatureSeries: false,
        signedBy: null,
        priceData: data.priceData || null,
        keyInfo: data.keyInfo || [],
        certificationNumber: null,
        labelType: null,
        pageQuality: null,
        gradeDate: null,
        graderNotes: null,
      });

      setShowBarcodeScanner(false);
      setState("review");
      showToast("Comic found!", "success");
    } catch (err) {
      console.error("Barcode lookup error:", err);
      showToast(
        err instanceof Error
          ? err.message
          : "We couldn't find this comic. Try scanning the cover instead.",
        "error"
      );
    } finally {
      setIsProcessingBarcode(false);
    }
  };

  const handleRetry = () => {
    if (imagePreview) {
      // Convert data URL back to file for retry
      fetch(imagePreview)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "comic.jpg", { type: "image/jpeg" });
          handleImageSelect(file, imagePreview);
        });
    } else {
      handleCancel();
    }
  };

  const getCurrentStepIndex = () => {
    return STEPS.findIndex((step) => step.id === state);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Handle bonus scan verification from email link */}
      <Suspense fallback={null}>
        <BonusVerificationHandler addBonusScans={addBonusScans} showToast={showToast} />
      </Suspense>

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-pop-black font-bold hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-3xl font-black text-pop-black font-comic">SCAN BOOK COVER</h1>
        <p className="text-gray-600 mt-2">
          Upload a photo of your comic book cover to identify and add it to your collection.
        </p>
      </div>

      {/* Progress Steps */}
      {state !== "error" && (
        <div className="mb-8">
          <div className="relative flex justify-between items-start">
            {/* Background connecting line */}
            <div className="absolute top-5 left-5 right-5 h-1 bg-gray-200 rounded" />
            {/* Progress line overlay */}
            <div
              className="absolute top-5 left-5 h-1 bg-green-500 rounded transition-all duration-300"
              style={{
                width:
                  getCurrentStepIndex() === 0
                    ? "0%"
                    : `calc(${(getCurrentStepIndex() / (STEPS.length - 1)) * 100}% - 40px)`,
              }}
            />

            {STEPS.map((step, index) => {
              const currentIndex = getCurrentStepIndex();
              const isCompleted = index < currentIndex;
              const isCurrent = index === currentIndex;
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-primary-600 text-white"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      isCurrent
                        ? "text-primary-600"
                        : isCompleted
                          ? "text-green-600"
                          : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload State */}
      {state === "upload" && (
        <>
          {/* Guest scan limit banner */}
          {isGuest && <GuestLimitBanner variant={isLimitReached ? "warning" : "info"} />}

          {isLimitReached ? (
            <div
              className="bg-pop-white border-3 border-pop-black p-8"
              style={{ boxShadow: "4px 4px 0px #000" }}
            >
              <GuestLimitBanner />
            </div>
          ) : (
            <div
              className="bg-pop-white border-3 border-pop-black p-8"
              style={{ boxShadow: "4px 4px 0px #000" }}
            >
              <ImageUpload onImageSelect={handleImageSelect} />

              {/* Alternative add methods */}
              <div className="mt-8 pt-6 border-t-2 border-pop-black">
                <p className="text-sm text-gray-600 text-center mb-4 font-bold uppercase">
                  Other ways to add your books:
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={() => setShowBarcodeScanner(true)}
                    className="flex flex-col items-center justify-center w-36 h-24 bg-pop-white text-pop-black border-2 border-pop-black font-bold hover:shadow-[3px_3px_0px_#000] transition-all"
                  >
                    <ScanBarcode className="w-7 h-7 mb-2" />
                    <span className="text-sm">Scan Barcode</span>
                  </button>
                  <button
                    onClick={handleManualEntry}
                    className="flex flex-col items-center justify-center w-36 h-24 bg-pop-white text-pop-black border-2 border-pop-black font-bold hover:shadow-[3px_3px_0px_#000] transition-all"
                  >
                    <PenLine className="w-7 h-7 mb-2" />
                    <span className="text-sm">Enter Manually</span>
                  </button>
                  {isSignedIn && (
                    <button
                      onClick={() => setShowCSVImport(true)}
                      className="flex flex-col items-center justify-center w-36 h-24 bg-pop-white text-pop-black border-2 border-pop-black font-bold hover:shadow-[3px_3px_0px_#000] transition-all"
                    >
                      <FileSpreadsheet className="w-7 h-7 mb-2" />
                      <span className="text-sm">Import CSV</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Analyzing State */}
      {state === "analyzing" && (
        <div
          className="bg-pop-white border-3 border-pop-black p-8"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Preview */}
            <div className="md:w-1/3">
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 relative">
                {imagePreview && (
                  <Image
                    src={imagePreview}
                    alt="Uploaded comic"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                )}
              </div>
            </div>

            {/* Loading State */}
            <div className="md:w-2/3 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                  <Wand2 className="w-10 h-10 text-primary-600" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-24 h-24 text-primary-300 animate-spin" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mt-6">Analyzing Comic Cover</h3>
              <p className="text-gray-600 mt-2">
                Hang tight! We&apos;re identifying the title, issue #, publisher, and more...
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse" />
                This should only take a few seconds. Enjoy these fun facts while you wait!
              </div>
              {currentFact && (
                <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-100 max-w-md">
                  <p className="text-sm text-primary-800 italic">&ldquo;{currentFact}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === "error" && (
        <div
          className="bg-pop-white border-3 border-pop-black p-8"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Preview */}
            {imagePreview && (
              <div className="md:w-1/3">
                <div className="aspect-[2/3] border-2 border-pop-black overflow-hidden bg-gray-100 relative">
                  <Image
                    src={imagePreview}
                    alt="Uploaded comic"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            <div
              className={`${imagePreview ? "md:w-2/3" : "w-full"} flex flex-col items-center justify-center text-center`}
            >
              <div className="w-16 h-16 bg-pop-red border-3 border-pop-black flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-black text-pop-black font-comic uppercase mt-4">
                Couldn&apos;t Recognize Comic
              </h3>
              <p className="text-gray-600 mt-2 max-w-md">{error}</p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-pop-blue border-2 border-pop-black text-white font-bold"
                  style={{ boxShadow: "2px 2px 0px #000" }}
                >
                  Try Again
                </button>
                <button
                  onClick={handleManualEntry}
                  className="px-4 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold"
                  style={{ boxShadow: "2px 2px 0px #000" }}
                >
                  Enter Manually
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 border-2 border-pop-black text-pop-black font-bold"
                  style={{ boxShadow: "2px 2px 0px #000" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review State */}
      {state === "review" && comicDetails && (
        <div
          className="bg-pop-white border-3 border-pop-black overflow-hidden"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <div className="flex flex-col lg:flex-row">
            {/* Image Preview */}
            <div className="lg:w-1/3 p-6 bg-gray-50 border-b-3 lg:border-b-0 lg:border-r-3 border-pop-black">
              <div className="sticky top-6">
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 shadow-lg relative group">
                  {imagePreview ? (
                    <>
                      <Image
                        src={imagePreview}
                        alt="Comic cover"
                        fill
                        className="object-cover cursor-pointer"
                        onClick={() => setShowEnlargedImage(true)}
                        unoptimized
                      />
                      {/* Zoom hint overlay */}
                      <div
                        className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors cursor-pointer flex items-center justify-center"
                        onClick={() => setShowEnlargedImage(true)}
                      >
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow-lg">
                          <ZoomIn className="w-5 h-5 text-gray-700" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>
                {imagePreview && (
                  <p className="text-xs text-gray-500 text-center mt-2">Tap image to enlarge</p>
                )}
                {!imagePreview && (
                  <div className="mt-4">
                    <ImageUpload onImageSelect={(_, preview) => setImagePreview(preview)} />
                  </div>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="lg:w-2/3 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Verify Comic Details</h2>
              <ComicDetailsForm
                key={comicDetails.id}
                comic={comicDetails}
                coverImageUrl={imagePreview}
                onCoverImageChange={setImagePreview}
                onSave={handleSave}
                onCancel={handleCancel}
                isLoading={isSaving}
                mode="add"
              />
            </div>
          </div>
        </div>
      )}

      {/* Saved State */}
      {state === "saved" && savedComic && (
        <div
          className="bg-pop-white border-3 border-pop-black p-8"
          style={{ boxShadow: "4px 4px 0px #000" }}
        >
          <div className="flex flex-col md:flex-row gap-8">
            {/* Image Preview */}
            <div className="md:w-1/3">
              <div
                className="aspect-[2/3] border-3 border-pop-black overflow-hidden bg-gray-100 relative"
                style={{ boxShadow: "4px 4px 0px #000" }}
              >
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Saved comic"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}
              </div>
            </div>

            {/* Success Message */}
            <div className="md:w-2/3 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-pop-green border-3 border-pop-black flex items-center justify-center">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-pop-black font-comic uppercase mt-6">
                Added to Collection!
              </h3>
              <p className="text-gray-600 mt-2">
                <span className="font-semibold">{savedComic.comic.title}</span>
                {savedComic.comic.issueNumber && ` #${savedComic.comic.issueNumber}`} has been
                saved.
              </p>

              {savedComic.comic.priceData?.estimatedValue && (
                <div className="mt-4 px-4 py-2 bg-pop-green border-2 border-pop-black">
                  <p className="text-sm text-white font-bold">
                    Estimated Value:{" "}
                    <span className="font-black">
                      ${savedComic.comic.priceData.estimatedValue.toFixed(2)}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
                <button
                  onClick={handleAddAnother}
                  className="px-5 py-3 bg-pop-blue border-2 border-pop-black text-white font-bold flex items-center gap-2"
                  style={{ boxShadow: "3px 3px 0px #000" }}
                >
                  <Camera className="w-5 h-5" />
                  Scan Another Book
                </button>
                <button
                  onClick={() => router.push("/collection")}
                  className="px-5 py-3 bg-pop-white border-2 border-pop-black text-pop-black font-bold"
                  style={{ boxShadow: "3px 3px 0px #000" }}
                >
                  View Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
          isProcessing={isProcessingBarcode}
        />
      )}

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl">
            <CSVImport
              onImportComplete={async (items) => {
                // Save all items to collection
                for (const item of items) {
                  await addToCollection(item);
                }

                // Create shop listings for items marked as for sale
                const forSaleItems = items.filter(
                  (item) => item.forSale && item.askingPrice && item.askingPrice >= 1
                );
                let listingsCreated = 0;
                let listingsFailed = 0;

                if (forSaleItems.length > 0 && isSignedIn) {
                  for (const item of forSaleItems) {
                    try {
                      const response = await fetch("/api/auctions", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          comicId: item.id,
                          comicData: item,
                          listingType: "fixed_price",
                          price: item.askingPrice,
                          shippingCost: 5, // Default shipping cost
                          description: item.notes || "",
                          acceptsOffers: false,
                        }),
                      });

                      if (response.ok) {
                        listingsCreated++;
                      } else {
                        listingsFailed++;
                        const errorData = await response.json().catch(() => ({}));
                        console.error(
                          `Failed to create listing for ${item.comic.title} #${item.comic.issueNumber}:`,
                          errorData
                        );
                      }
                    } catch (error) {
                      listingsFailed++;
                      console.error(
                        `Error creating listing for ${item.comic.title} #${item.comic.issueNumber}:`,
                        error
                      );
                    }
                  }
                }

                let message = `Successfully imported ${items.length} comics!`;
                if (listingsCreated > 0 && listingsFailed === 0) {
                  message = `Imported ${items.length} comics and created ${listingsCreated} shop listings!`;
                } else if (listingsCreated > 0 && listingsFailed > 0) {
                  message = `Imported ${items.length} comics. Created ${listingsCreated} listings (${listingsFailed} failed).`;
                } else if (forSaleItems.length > 0 && listingsCreated === 0) {
                  message = `Imported ${items.length} comics. Shop listings could not be created - check console for details.`;
                }
                showToast(message, "success");
                setShowCSVImport(false);
                router.push("/collection");
              }}
              onCancel={() => setShowCSVImport(false)}
            />
          </div>
        </div>
      )}

      {/* Sign-Up Milestone Modal */}
      {milestoneToShow && (
        <SignUpPromptModal
          milestone={milestoneToShow}
          scanCount={count}
          onClose={() => {
            markMilestoneShown(milestoneToShow);
            setMilestoneToShow(null);
          }}
        />
      )}

      {/* Enlarged Image Modal */}
      {showEnlargedImage && imagePreview && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowEnlargedImage(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowEnlargedImage(false)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Hint text */}
          <p className="absolute top-4 left-4 text-white/70 text-sm">Tap anywhere to close</p>

          {/* Enlarged image */}
          <div
            className="relative max-w-full max-h-[90vh] w-auto h-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={imagePreview}
              alt="Enlarged comic cover"
              width={800}
              height={1200}
              className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
