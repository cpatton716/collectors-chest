import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { validateBody } from "@/lib/validation";

const publisherSchema = z.object({
  publisherName: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Publisher name required").max(200)),
});

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const validated = validateBody(publisherSchema, body);
  if (!validated.success) return validated.response;
  const { publisherName } = validated.data;

  const { error } = await supabaseAdmin.from("key_info_submissions").insert({
    user_id: userId,
    title: "PUBLISHER_SUGGESTION",
    issue_number: "",
    suggested_key_info: [`Publisher suggestion: ${publisherName}`],
    status: "pending",
  });

  if (error) {
    console.error("Publisher suggestion insert failed:", error);
    return Response.json({ error: "Failed to submit" }, { status: 500 });
  }

  return Response.json({ success: true });
}
