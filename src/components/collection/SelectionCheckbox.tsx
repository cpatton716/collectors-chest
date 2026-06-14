// src/components/collection/SelectionCheckbox.tsx
"use client";

import { Check } from "lucide-react";

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: () => void;
  /** Accessible label describing what is being selected (e.g. the comic title). */
  label?: string;
}

export function SelectionCheckbox({ checked, onChange, label }: SelectionCheckboxProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      // Outer button is a 44x44 tap target (WCAG 2.5.5); the visible box
      // stays 24x24 and is centered within it via flex centering.
      className="w-11 h-11 -m-2.5 flex items-center justify-center"
      aria-checked={checked}
      role="checkbox"
      aria-label={label ? `Select ${label}` : "Select item"}
    >
      <span
        className={`w-6 h-6 border-2 border-pop-black flex items-center justify-center transition-all ${
          checked
            ? "bg-pop-green shadow-[2px_2px_0px_#000]"
            : "bg-pop-white hover:bg-pop-cream"
        }`}
      >
        {checked && <Check className="w-4 h-4 text-pop-white" strokeWidth={3} />}
      </span>
    </button>
  );
}
