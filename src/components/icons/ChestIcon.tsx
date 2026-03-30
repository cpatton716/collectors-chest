/* eslint-disable @next/next/no-img-element */

interface ChestIconProps {
  className?: string;
  size?: number;
}

export function ChestIcon({ className = "", size = 32 }: ChestIconProps) {
  return (
    <img
      src="/icons/icon-512x512.png"
      alt="Collectors Chest"
      width={size}
      height={Math.round(size * (490 / 512))}
      className={className}
    />
  );
}
