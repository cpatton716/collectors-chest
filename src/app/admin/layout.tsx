"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BarChart3, BookKey, MessageSquare, ScanLine, ArrowLeft } from "lucide-react";

const adminLinks = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/moderation", label: "Moderation", icon: MessageSquare },
  { href: "/admin/key-info", label: "Key Info", icon: BookKey },
  { href: "/admin/barcode-reviews", label: "Barcodes", icon: ScanLine },
  { href: "/admin/usage", label: "Usage", icon: BarChart3 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b-4 border-black" style={{ background: "var(--pop-yellow)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Header row */}
          <div className="flex items-center justify-between mb-2 md:mb-0">
            <h2
              className="text-lg font-bold whitespace-nowrap"
              style={{ fontFamily: "var(--font-bangers)" }}
            >
              Admin
            </h2>
            <Link
              href="/collection"
              className="flex items-center gap-1 text-sm font-medium hover:underline whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          </div>
          {/* Tab navigation */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
            {adminLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-black text-white"
                      : "hover:bg-black/10"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
