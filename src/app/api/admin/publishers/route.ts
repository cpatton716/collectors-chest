import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { publisherName } = await request.json();
  if (!publisherName?.trim()) {
    return Response.json({ error: "Publisher name required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("key_info_submissions").insert({
    user_id: userId,
    title: "PUBLISHER_SUGGESTION",
    issue_number: "",
    suggested_key_info: [`Publisher suggestion: ${publisherName.trim()}`],
    status: "pending",
  });

  if (error) {
    console.error("Publisher suggestion insert failed:", error);
    return Response.json({ error: "Failed to submit" }, { status: 500 });
  }

  return Response.json({ success: true });
}
