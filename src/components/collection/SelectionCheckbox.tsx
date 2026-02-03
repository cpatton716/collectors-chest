// src/components/collection/SelectionCheckbox.tsx
"use client";

import { Check } from "lucide-react";

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: () => void;
}

export function SelectionCheckbox({ checked, onChange }: SelectionCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`w-6 h-6 border-2 border-pop-black flex items-center justify-center transition-all ${
        checked
          ? "bg-pop-green shadow-[2px_2px_0px_#000]"
          : "bg-pop-white hover:bg-pop-cream"
      }`}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <Check className="w-4 h-4 text-pop-white" strokeWidth={3} />}
    </button>
  );
}
