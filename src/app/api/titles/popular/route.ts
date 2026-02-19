import { NextResponse } from "next/server";

import { cacheGetOrSet } from "@/lib/cache";
import { supabase } from "@/lib/supabase";

interface PopularTitle {
  title: string;
  publisher: string | null;
  lookupCount: number;
}

export async function GET() {
  try {
    const { data } = await cacheGetOrSet<PopularTitle[]>(
      "top20",
      "popularTitles",
      async () => {
        const { data, error } = await supabase
          .from("comic_metadata")
          .select("title, publisher, lookup_count")
          .order("lookup_count", { ascending: false })
          .limit(100);

        if (error || !data) return [];

        // Deduplicate by title (keep highest lookup_count per title)
        const titleMap = new Map<string, PopularTitle>();
        for (const row of data) {
          const key = row.title.toLowerCase();
          const existing = titleMap.get(key);
          if (!existing || row.lookup_count > existing.lookupCount) {
            titleMap.set(key, {
              title: row.title,
              publisher: row.publisher,
              lookupCount: row.lookup_count,
            });
          }
        }

        return Array.from(titleMap.values())
          .sort((a, b) => b.lookupCount - a.lookupCount)
          .slice(0, 20);
      }
    );

    return NextResponse.json({ titles: data });
  } catch (error) {
    console.error("Error fetching popular titles:", error);
    return NextResponse.json({ titles: [] });
  }
}
