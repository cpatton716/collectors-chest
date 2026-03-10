// .github/scripts/discover-model.ts
//
// Queries Anthropic's Models API to find the latest available model
// in the same family as the current (deprecated) model.
// Handles pagination via has_more field.
// Outputs the new model ID to stdout.
// Outputs the full candidate list to stderr (for alert inclusion).
// Exit 0 = found replacement. Exit 1 = no replacement found.

import Anthropic from "@anthropic-ai/sdk";

const DEPRECATED_MODEL_ID = process.env.CURRENT_MODEL_ID;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DEPRECATED_MODEL_ID || !API_KEY) {
  console.error("Missing CURRENT_MODEL_ID or ANTHROPIC_API_KEY");
  process.exit(2);
}

// Extract the model family by stripping the 8-digit date suffix.
// e.g., "claude-sonnet-4-20250514" -> "claude-sonnet-4"
// e.g., "claude-haiku-4-5-20251001" -> "claude-haiku-4-5"
function getModelFamily(modelId: string): string {
  return modelId.replace(/-\d{8}$/, "");
}

async function discover(): Promise<void> {
  const client = new Anthropic({ apiKey: API_KEY });
  const family = getModelFamily(DEPRECATED_MODEL_ID!);

  console.error(`Looking for models in family: ${family}`);

  try {
    // Paginate through all available models
    const allModels: Array<{ id: string; created_at: string }> = [];
    let hasMore = true;
    let afterId: string | undefined;

    while (hasMore) {
      const params: { limit: number; after_id?: string } = { limit: 100 };
      if (afterId) {
        params.after_id = afterId;
      }

      const response = await client.models.list(params);
      allModels.push(...response.data);

      hasMore = response.has_more === true;
      if (hasMore && response.data.length > 0) {
        afterId = response.data[response.data.length - 1].id;
      }
    }

    console.error(`Total models fetched: ${allModels.length}`);

    // Filter to same family, sort by created_at descending (newest first)
    const candidates = allModels
      .filter((m) => {
        const candidateFamily = getModelFamily(m.id);
        return candidateFamily === family && m.id !== DEPRECATED_MODEL_ID;
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

    // Output full candidate list to stderr (captured by workflow for alerts)
    console.error(`CANDIDATES:${JSON.stringify(candidates.map((c) => c.id))}`);

    if (candidates.length === 0) {
      console.error(`No replacement models found in family "${family}"`);
      console.error(
        `Available models: ${allModels.map((m) => m.id).join(", ")}`
      );
      process.exit(1);
    }

    const newModel = candidates[0];
    console.error(
      `Found replacement: ${newModel.id} (created: ${newModel.created_at})`
    );

    // Output ONLY the model ID to stdout (workflow reads this)
    console.log(newModel.id);
    process.exit(0);
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error(`Failed to list models: ${error.message}`);
    process.exit(1);
  }
}

discover();
