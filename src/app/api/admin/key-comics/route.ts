import { NextRequest, NextResponse } from "next/server";

import { getAdminProfile } from "@/lib/adminAuth";
import { createKeyComic, searchKeyComics } from "@/lib/keyComicsDb";

// GET - Search/list key_comics entries
export async function GET(request: NextRequest) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const source = searchParams.get("source") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");

    const result = await searchKeyComics({ search, source, page, limit });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      entries: result.entries,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching key comics:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// POST - Create a new key_comics entry
export async function POST(request: NextRequest) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, issueNumber, publisher, keyInfo } = body;

    if (!title || !issueNumber || !keyInfo || keyInfo.length === 0) {
      return NextResponse.json(
        { error: "Title, issue number, and at least one key info entry are required" },
        { status: 400 }
      );
    }

    const result = await createKeyComic({ title, issueNumber, publisher, keyInfo });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating key comic:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
