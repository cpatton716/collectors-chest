"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";

import { storage } from "@/lib/storage";

import { useCollection } from "@/hooks/useCollection";

import { CollectionStats } from "@/components/CollectionStats";
import { ComicDetailModal } from "@/components/ComicDetailModal";
import { FeatureGate } from "@/components/FeatureGate";
import { CollectionPageSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";

import { CollectionItem } from "@/types/comic";

export default function StatsPage() {
  const router = useRouter();
  const { isLoaded: authLoaded } = useUser();
  const { showToast } = useToast();
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);

  // Use collection hook for cloud sync (same as collection page)
  const {
    collection,
    lists,
    isLoading: collectionLoading,
    refresh,
    removeFromCollection,
    createList,
    addItemToList,
    removeItemFromList,
    recordSale,
    updateCollectionItem,
  } = useCollection();

  const isLoaded = authLoaded && !collectionLoading;

  const handleRefresh = () => {
    refresh();
    showToast("Statistics refreshed", "success");
  };

  const handleComicClick = (item: CollectionItem) => {
    setSelectedItem(item);
    storage.addToRecentlyViewed(item.id);
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
  };

  const handleRemove = async (id: string) => {
    const item = collection.find((c) => c.id === id);
    await removeFromCollection(id);
    setSelectedItem(null);
    showToast(`"${item?.comic.title}" removed from collection`, "success");
  };

  const handleAddToList = async (itemId: string, listId: string) => {
    await addItemToList(itemId, listId);
    const list = lists.find((l) => l.id === listId);
    const item = collection.find((i) => i.id === itemId);
    showToast(`Added to "${list?.name}"`, "success");
    if (item) {
      setSelectedItem(item);
    }
  };

  const handleRemoveFromList = async (itemId: string, listId: string) => {
    await removeItemFromList(itemId, listId);
    const list = lists.find((l) => l.id === listId);
    showToast(`Removed from "${list?.name}"`, "info");
    const updatedItem = collection.find((item) => item.id === itemId);
    if (updatedItem) {
      setSelectedItem(updatedItem);
    }
  };

  const handleCreateList = async (name: string) => {
    const newList = await createList(name);
    showToast(`List "${name}" created`, "success");
    return newList;
  };

  const handleMarkSold = async (itemId: string, salePrice: number) => {
    const item = collection.find((c) => c.id === itemId);
    if (item) {
      const profit = salePrice - (item.purchasePrice || 0);
      await recordSale(item, salePrice);
      setSelectedItem(null);
      showToast(
        `Sale recorded! ${profit >= 0 ? "Profit" : "Loss"}: $${Math.abs(profit).toFixed(2)}`,
        profit >= 0 ? "success" : "info"
      );
    }
  };

  const handleToggleStar = async (itemId: string) => {
    const item = collection.find((c) => c.id === itemId);
    if (item) {
      await updateCollectionItem(itemId, {
        isStarred: !item.isStarred,
      });
      showToast(item.isStarred ? "Removed from favorites" : "Added to favorites", "success");
    }
  };

  const handleEdit = (item: CollectionItem) => {
    // Navigate to collection page for editing
    router.push("/collection");
  };

  if (!isLoaded) {
    return <CollectionPageSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/collection")}
            className="p-2 border-2 border-pop-black bg-pop-white hover:shadow-[2px_2px_0px_#000] transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-pop-black" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pop-blue border-2 border-pop-black flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-black text-pop-black font-comic">
                COLLECTION STATISTICS
              </h1>
            </div>
            <p className="text-gray-600 mt-1 ml-14">
              Detailed analytics and insights for your comic collection
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 bg-pop-white border-2 border-pop-black text-pop-black font-bold hover:shadow-[2px_2px_0px_#000] transition-all"
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </button>
      </div>

      {/* Stats Content - Premium Feature */}
      <FeatureGate feature="fullStats">
        <CollectionStats collection={collection} onComicClick={handleComicClick} />
      </FeatureGate>

      {/* Comic Detail Modal */}
      {selectedItem && (
        <ComicDetailModal
          item={selectedItem}
          lists={lists}
          collection={collection}
          onClose={handleCloseModal}
          onRemove={handleRemove}
          onAddToList={handleAddToList}
          onRemoveFromList={handleRemoveFromList}
          onCreateList={handleCreateList}
          onMarkSold={handleMarkSold}
          onToggleStar={handleToggleStar}
          onEdit={handleEdit}
          onViewItem={(item) => setSelectedItem(item)}
        />
      )}
    </div>
  );
}
