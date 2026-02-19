import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";

import { MODEL_LIGHTWEIGHT } from "@/lib/models";
import { supabaseAdmin } from "@/lib/supabase";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ModerationResult {
  severity: "low" | "medium" | "high" | "critical";
  priorityScore: number; // 1-10, where 1 is highest priority
  suggestedAction: "none" | "warn" | "review" | "suspend";
  shouldReport: boolean;
  suggestedReason: "spam" | "harassment" | "inappropriate" | "scam" | "other";
  explanation: string;
}

interface FlaggedMessage {
  id: string;
  content: string;
  sender_id: string;
  flag_reason: string | null;
}

/**
 * Analyze a message using Claude to determine if it violates policies
 */
async function analyzeMessage(
  content: string,
  flagReason: string | null
): Promise<ModerationResult> {
  const response = await anthropic.messages.create({
    model: MODEL_LIGHTWEIGHT,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are a content moderator for a comic book trading marketplace called Collectors Chest. Analyze this message for policy violations.

Message content: "${content}"
Initial flag reason: ${flagReason || "Content filter triggered"}

Context: This is a peer-to-peer messaging system where users discuss buying, selling, and trading comic books. Normal marketplace conversations about pricing, condition, shipping, and negotiations are expected and acceptable.

Evaluate for:
- Spam (repetitive, promotional, or off-topic content)
- Harassment (personal attacks, threats, bullying)
- Inappropriate content (explicit, offensive, or discriminatory)
- Scam attempts (suspicious payment requests, phishing, fraud indicators)
- Other policy violations

Respond ONLY with valid JSON in this exact format:
{
  "severity": "low" | "medium" | "high" | "critical",
  "priorityScore": 1-10 (1 = most urgent, 10 = least concern),
  "suggestedAction": "none" | "warn" | "review" | "suspend",
  "shouldReport": boolean,
  "suggestedReason": "spam" | "harassment" | "inappropriate" | "scam" | "other",
  "explanation": "Brief explanation of your assessment"
}

Guidelines:
- "low" = Minor issue or false positive, no action needed
- "medium" = Concerning content that warrants review
- "high" = Clear violation requiring attention
- "critical" = Severe violation requiring immediate action
- Set shouldReport=true only for "medium" severity or higher
- Be conservative: legitimate marketplace discussions should not be flagged

Suggested Action Guidelines:
- "none" = No action needed, false positive or minor issue
- "warn" = Send a warning to the user
- "review" = Requires human moderator review
- "suspend" = User account should be suspended immediately

Priority Score Guidelines:
- Priority 1-3 = Critical issues requiring immediate attention
- Priority 4-6 = Important issues requiring review
- Priority 7-10 = Low priority or false positives`,
      },
    ],
  });

  // Parse the response
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    console.error("Failed to parse moderation response:", text);
    return {
      severity: "low",
      priorityScore: 10,
      suggestedAction: "none",
      shouldReport: false,
      suggestedReason: "other",
      explanation: "Failed to parse AI response - defaulting to safe",
    };
  }

  try {
    const result = JSON.parse(jsonMatch[0]) as ModerationResult;
    return result;
  } catch {
    console.error("Invalid JSON in moderation response:", jsonMatch[0]);
    return {
      severity: "low",
      priorityScore: 10,
      suggestedAction: "none",
      shouldReport: false,
      suggestedReason: "other",
      explanation: "Invalid JSON from AI - defaulting to safe",
    };
  }
}

// POST - Process flagged messages (called by cron)
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: require CRON_SECRET to be set and match
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch unmoderated flagged messages (limit to 50 per run to manage costs)
    const { data: flaggedMessages, error: fetchError } = await supabaseAdmin
      .from("messages")
      .select("id, content, sender_id, flag_reason")
      .eq("is_flagged", true)
      .eq("auto_moderated", false)
      .limit(50);

    if (fetchError) {
      console.error("Error fetching flagged messages:", fetchError);
      throw fetchError;
    }

    if (!flaggedMessages || flaggedMessages.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        reports: 0,
        message: "No flagged messages to process",
      });
    }

    let reportsCreated = 0;
    const errors: string[] = [];

    for (const message of flaggedMessages as FlaggedMessage[]) {
      try {
        // Analyze message with Claude
        const result = await analyzeMessage(message.content, message.flag_reason);

        // Update message with moderation result
        const { error: updateError } = await supabaseAdmin
          .from("messages")
          .update({
            auto_moderated: true,
            auto_moderation_result: result,
          })
          .eq("id", message.id);

        if (updateError) {
          console.error(`Error updating message ${message.id}:`, updateError);
          errors.push(`Update error for ${message.id}: ${updateError.message}`);
          continue;
        }

        // Create report if AI recommends it
        if (result.shouldReport) {
          const { error: reportError } = await supabaseAdmin.from("message_reports").insert({
            message_id: message.id,
            reporter_id: null, // System-generated report
            reason: result.suggestedReason,
            details: `[Auto-moderated] Severity: ${result.severity}. Suggested action: ${result.suggestedAction}. ${result.explanation}`,
            status: "pending",
            priority: result.priorityScore,
          });

          if (reportError) {
            console.error(`Error creating report for message ${message.id}:`, reportError);
            errors.push(`Report error for ${message.id}: ${reportError.message}`);
          } else {
            reportsCreated++;
          }
        }
      } catch (msgError) {
        const errorMessage = msgError instanceof Error ? msgError.message : "Unknown error";
        console.error(`Error processing message ${message.id}:`, msgError);
        errors.push(`Processing error for ${message.id}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed: flaggedMessages.length,
      reports: reportsCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in moderation cron job:", error);
    return NextResponse.json({ error: "Failed to process moderation cron job" }, { status: 500 });
  }
}

// GET - Allow manual triggering for development testing
export async function GET(_request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  // For dev testing, bypass auth check and run the moderation logic directly
  try {
    // Fetch unmoderated flagged messages
    const { data: flaggedMessages, error: fetchError } = await supabaseAdmin
      .from("messages")
      .select("id, content, sender_id, flag_reason")
      .eq("is_flagged", true)
      .eq("auto_moderated", false)
      .limit(50);

    if (fetchError) {
      console.error("Error fetching flagged messages:", fetchError);
      throw fetchError;
    }

    if (!flaggedMessages || flaggedMessages.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        reports: 0,
        message: "No flagged messages to process",
      });
    }

    let reportsCreated = 0;
    const errors: string[] = [];

    for (const message of flaggedMessages as FlaggedMessage[]) {
      try {
        const result = await analyzeMessage(message.content, message.flag_reason);

        const { error: updateError } = await supabaseAdmin
          .from("messages")
          .update({
            auto_moderated: true,
            auto_moderation_result: result,
          })
          .eq("id", message.id);

        if (updateError) {
          errors.push(`Update error for ${message.id}: ${updateError.message}`);
          continue;
        }

        if (result.shouldReport) {
          const { error: reportError } = await supabaseAdmin.from("message_reports").insert({
            message_id: message.id,
            reporter_id: null,
            reason: result.suggestedReason,
            details: `[Auto-moderated] Severity: ${result.severity}. Suggested action: ${result.suggestedAction}. ${result.explanation}`,
            status: "pending",
            priority: result.priorityScore,
          });

          if (reportError) {
            errors.push(`Report error for ${message.id}: ${reportError.message}`);
          } else {
            reportsCreated++;
          }
        }
      } catch (msgError) {
        const errorMessage = msgError instanceof Error ? msgError.message : "Unknown error";
        errors.push(`Processing error for ${message.id}: ${errorMessage}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed: flaggedMessages.length,
      reports: reportsCreated,
      errors: errors.length > 0 ? errors : undefined,
      mode: "development",
    });
  } catch (error) {
    console.error("Error in moderation cron job (dev):", error);
    return NextResponse.json({ error: "Failed to process moderation cron job" }, { status: 500 });
  }
}
