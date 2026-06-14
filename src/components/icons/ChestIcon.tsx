import Image from "next/image";

interface ChestIconProps {
  className?: string;
  size?: number;
}

// Source emblem is 878x840 (see public/icons/emblem.png). Preserve that aspect
// ratio when scaling to the requested `size`. Rendered with next/image and
// `priority` because the logo sits in the always-visible top nav (above the
// fold on every page). Audit ref L-FE22.
const EMBLEM_WIDTH = 878;
const EMBLEM_HEIGHT = 840;

export function ChestIcon({ className = "", size = 32 }: ChestIconProps) {
  const height = Math.round(size * (EMBLEM_HEIGHT / EMBLEM_WIDTH));
  return (
    <Image
      src="/icons/emblem.png"
      alt="Collectors Chest"
      width={size}
      height={height}
      priority
      className={className}
    />
  );
}
