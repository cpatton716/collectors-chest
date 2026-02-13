import { NextRequest, NextResponse } from "next/server";

import { getAdminProfile } from "@/lib/adminAuth";
import { deleteKeyComic, updateKeyComic } from "@/lib/keyComicsDb";

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

    const { id } = await params;
    const body = await request.json();
    const { title, issueNumber, publisher, keyInfo } = body;

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

    const { id } = await params;
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
