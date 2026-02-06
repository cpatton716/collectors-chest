import { Metadata } from "next";
import { notFound } from "next/navigation";

import { calculatePublicStats, getPublicComics, getPublicLists, getPublicProfile } from "@/lib/db";

import { PublicCollectionView } from "./PublicCollectionView";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) {
    return {
      title: "Collection Not Found | Collectors Chest",
    };
  }

  const displayName = profile.publicDisplayName || profile.displayName || profile.username || slug || "A Collector";

  return {
    title: `${displayName}'s Collection | Collectors Chest`,
    description:
      profile.publicBio || `Check out ${displayName}'s comic book collection on Collectors Chest.`,
    openGraph: {
      title: `${displayName}'s Comic Collection`,
      description:
        profile.publicBio ||
        `Check out ${displayName}'s comic book collection on Collectors Chest.`,
      type: "profile",
    },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) {
    notFound();
  }

  // Fetch comics and lists in parallel
  const [comics, lists] = await Promise.all([
    getPublicComics(profile.id),
    getPublicLists(profile.id),
  ]);

  // Calculate stats
  const stats = calculatePublicStats(comics);

  return <PublicCollectionView profile={profile} comics={comics} lists={lists} stats={stats} />;
}
