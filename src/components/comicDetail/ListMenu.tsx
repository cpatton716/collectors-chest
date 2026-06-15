"use client";

import { Check, ListPlus, Plus } from "lucide-react";

import { UserList } from "@/types/comic";

interface ListMenuProps {
  lists: UserList[];
  customLists: UserList[];
  hasCustomLists: boolean;
  showListMenu: boolean;
  showCreateList: boolean;
  newListName: string;
  isInList: (listId: string) => boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onShowCreateList: () => void;
  onHideCreateList: () => void;
  onNewListNameChange: (value: string) => void;
  onCreateList: () => void;
  onToggleList: (listId: string) => void;
}

/**
 * "Add to List" dropdown button + menu extracted from ComicDetailModal
 * (R3 / M-CO15). Presentational: markup verbatim, all state + handlers live in
 * the parent and are passed in via props.
 */
export function ListMenu({
  lists,
  customLists,
  hasCustomLists,
  showListMenu,
  showCreateList,
  newListName,
  isInList,
  onToggleMenu,
  onCloseMenu,
  onShowCreateList,
  onHideCreateList,
  onNewListNameChange,
  onCreateList,
  onToggleList,
}: ListMenuProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggleMenu}
        className="w-full px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
      >
        <ListPlus className="w-4 h-4" />
        Add to List
      </button>

      {/* List Menu Dropdown */}
      {showListMenu && (
        <>
          {/* Invisible overlay to close dropdown when clicking outside */}
          <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
            {!hasCustomLists && !showCreateList ? (
              <div className="px-4 py-3 text-center">
                <p className="text-sm text-gray-500 mb-3">
                  You don&apos;t have any custom lists yet.
                </p>
                <button
                  onClick={onShowCreateList}
                  className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors flex items-center gap-1 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Create New List
                </button>
              </div>
            ) : showCreateList ? (
              <div className="px-3 py-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => onNewListNameChange(e.target.value)}
                  placeholder="List name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 bg-white text-gray-900"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={onCreateList}
                    disabled={!newListName.trim()}
                    className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Create &amp; Add
                  </button>
                  <button
                    onClick={onHideCreateList}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Default Lists */}
                <div className="px-3 py-1">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Default Lists</p>
                  {lists
                    .filter((l) => l.isDefault && l.id !== "collection")
                    .map((list) => (
                      <button
                        key={list.id}
                        onClick={() => onToggleList(list.id)}
                        className="w-full px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 rounded flex items-center justify-between"
                      >
                        <span>{list.name}</span>
                        {isInList(list.id) && <Check className="w-4 h-4 text-green-600" />}
                      </button>
                    ))}
                </div>

                {/* Custom Lists */}
                {customLists.length > 0 && (
                  <div className="px-3 py-1 border-t mt-1 pt-1">
                    <p className="text-xs text-gray-400 uppercase font-medium mb-1">Custom Lists</p>
                    {customLists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => onToggleList(list.id)}
                        className="w-full px-2 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-100 rounded flex items-center justify-between"
                      >
                        <span>{list.name}</span>
                        {isInList(list.id) && <Check className="w-4 h-4 text-green-600" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Create New */}
                <div className="border-t mt-1 pt-1 px-3">
                  <button
                    onClick={onShowCreateList}
                    className="w-full px-2 py-1.5 text-left text-sm text-primary-600 hover:bg-primary-50 rounded flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Create New List
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
