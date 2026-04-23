import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProfile } from "@/lib/adminAuth";
import { createKeyComic, searchKeyComics } from "@/lib/keyComicsDb";
import { validateBody, validateQuery } from "@/lib/validation";

const listQuerySchema = z.object({
  search: z.string().max(200).optional(),
  source: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});

const createSchema = z.object({
  title: z.string().min(1).max(500),
  issueNumber: z.string().min(1).max(50),
  publisher: z.string().max(200).optional().nullable(),
  keyInfo: z.array(z.string().min(1).max(500)).min(1, "At least one key info entry is required").max(50),
});

// GET - Search/list key_comics entries
export async function GET(request: NextRequest) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = validateQuery(listQuerySchema, searchParams);
    if (!queryResult.success) return queryResult.response;
    const { search, source, page, limit } = queryResult.data;

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

    const body = await request.json().catch(() => null);
    const validated = validateBody(createSchema, body);
    if (!validated.success) return validated.response;
    const { title, issueNumber, publisher, keyInfo } = validated.data;

    const result = await createKeyComic({ title, issueNumber, publisher: publisher ?? undefined, keyInfo });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating key comic:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
