import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getAdminProfile } from "@/lib/adminAuth";
import { deleteKeyComic, updateKeyComic } from "@/lib/keyComicsDb";
import { schemas, validateBody, validateParams } from "@/lib/validation";

const paramsSchema = z.object({ id: schemas.uuid });

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  issueNumber: z.string().min(1).max(50).optional(),
  publisher: z.string().max(200).optional(),
  keyInfo: z.array(z.string().min(1).max(500)).max(50).optional(),
});

// PATCH - Update a key_comics entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { id } = paramsResult.data;

    const body = await request.json().catch(() => null);
    const validated = validateBody(updateSchema, body);
    if (!validated.success) return validated.response;
    const { title, issueNumber, publisher, keyInfo } = validated.data;

    const result = await updateKeyComic(id, {
      title,
      issueNumber,
      publisher,
      keyInfo,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating key comic:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE - Delete a key_comics entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await getAdminProfile();
    if (!adminProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawParams = await params;
    const paramsResult = validateParams(paramsSchema, rawParams);
    if (!paramsResult.success) return paramsResult.response;
    const { id } = paramsResult.data;
    const result = await deleteKeyComic(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting key comic:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
