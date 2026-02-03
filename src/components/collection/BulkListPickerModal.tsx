// src/components/collection/BulkListPickerModal.tsx
"use client";

import { useState } from "react";

import { ListPlus, Plus, X } from "lucide-react";

import { UserList } from "@/types/comic";

interface BulkListPickerModalProps {
  lists: UserList[];
  selectionCount: number;
  onSelect: (listId: string) => void;
  onCreateList: (name: string) => Promise<UserList>;
  onCancel: () => void;
}

export function BulkListPickerModal({
  lists,
  selectionCount,
  onSelect,
  onCreateList,
  onCancel,
}: BulkListPickerModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out the default "collection" list
  const userLists = lists.filter((l) => l.id !== "collection");

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setIsSubmitting(true);
    try {
      const newList = await onCreateList(newListName.trim());
      onSelect(newList.id);
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] max-w-sm w-full">
        {/* Header */}
        <div className="bg-pop-blue border-b-4 border-pop-black p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListPlus className="w-6 h-6 text-pop-white" />
            <h2 className="font-comic text-pop-white text-lg">
              ADD {selectionCount} TO LIST
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-pop-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-pop-white" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[300px] overflow-y-auto">
          {userLists.length === 0 && !isCreating ? (
            <p className="text-pop-black/70 font-body text-center py-4">
              No lists yet. Create one below!
            </p>
          ) : (
            <div className="space-y-2">
              {userLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => onSelect(list.id)}
                  className="w-full px-4 py-3 bg-pop-cream border-2 border-pop-black font-comic text-left hover:shadow-[2px_2px_0px_#000] transition-all"
                >
                  {list.name}
                </button>
              ))}
            </div>
          )}

          {/* Create New List */}
          {isCreating ? (
            <div className="mt-4 p-3 border-2 border-pop-black border-dashed">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name..."
                className="w-full px-3 py-2 border-2 border-pop-black font-body mb-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateList();
                  if (e.key === "Escape") setIsCreating(false);
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-3 py-2 bg-pop-cream border-2 border-pop-black font-comic text-sm"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || isSubmitting}
                  className="flex-1 px-3 py-2 bg-pop-green border-2 border-pop-black font-comic text-sm text-pop-white disabled:opacity-50"
                >
                  CREATE & ADD
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full mt-4 px-4 py-3 border-2 border-pop-black border-dashed font-comic text-pop-black/70 flex items-center justify-center gap-2 hover:bg-pop-cream transition-colors"
            >
              <Plus className="w-4 h-4" />
              CREATE NEW LIST
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
