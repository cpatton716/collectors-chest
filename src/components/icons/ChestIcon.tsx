/* eslint-disable @next/next/no-img-element */

interface ChestIconProps {
  className?: string;
  size?: number;
}

export function ChestIcon({ className = "", size = 32 }: ChestIconProps) {
  return (
    <img
      src="/icons/emblem.png"
      alt="Collectors Chest"
      width={size}
      height={Math.round(size * (840 / 878))}
      className={className}
    />
  );
}
