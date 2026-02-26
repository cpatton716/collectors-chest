import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-8 pt-4 pb-8 border-t-4 border-pop-black">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-body text-pop-black/70">
        <p>
          &copy; {new Date().getFullYear()} Collectors Chest. All rights
          reserved.
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="hover:text-pop-blue transition-colors font-comic"
          >
            PRIVACY
          </Link>
          <Link
            href="/terms"
            className="hover:text-pop-blue transition-colors font-comic"
          >
            TERMS
          </Link>
        </div>
      </div>
    </footer>
  );
}
