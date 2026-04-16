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

// Extract the tier (sonnet/opus/haiku) from a model ID. Covers every known
// Anthropic naming pattern so that minor-version bumps (4.0 → 4.5 → 4.6) and
// the older "claude-3-haiku" layout still resolve to the same tier.
//   claude-sonnet-4-20250514   -> sonnet
//   claude-sonnet-4-5-20250929 -> sonnet
//   claude-sonnet-4-6          -> sonnet
//   claude-3-haiku-20240307    -> haiku
function getModelTier(modelId: string): string | null {
  const match = modelId.match(/claude-(?:\d+-)?(sonnet|opus|haiku)(?:-|$)/);
  return match ? match[1] : null;
}

function hasDateSuffix(modelId: string): boolean {
  return /-\d{8}$/.test(modelId);
}

async function discover(): Promise<void> {
  const client = new Anthropic({ apiKey: API_KEY });
  const tier = getModelTier(DEPRECATED_MODEL_ID!);

  if (!tier) {
    console.error(
      `Could not extract tier from model ID: ${DEPRECATED_MODEL_ID}`
    );
    process.exit(1);
  }

  console.error(`Looking for replacement in tier: ${tier}`);

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

    // Look up the current model's created_at so we never downgrade to an older
    // snapshot in the same tier. If the model is fully gone from the API list,
    // fall back to accepting any same-tier candidate.
    const current = allModels.find((m) => m.id === DEPRECATED_MODEL_ID);
    const currentCreatedAt = current
      ? new Date(current.created_at).getTime()
      : 0;

    // Same tier, strictly newer than the deprecated model. Prefer dated
    // snapshots over undated aliases to match our pinning policy
    // (see src/lib/models.ts), then sort by created_at descending.
    const candidates = allModels
      .filter((m) => {
        if (m.id === DEPRECATED_MODEL_ID) return false;
        if (getModelTier(m.id) !== tier) return false;
        return new Date(m.created_at).getTime() > currentCreatedAt;
      })
      .sort((a, b) => {
        const aDated = hasDateSuffix(a.id) ? 1 : 0;
        const bDated = hasDateSuffix(b.id) ? 1 : 0;
        if (aDated !== bDated) return bDated - aDated;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

    // Output full candidate list to stderr (captured by workflow for alerts)
    console.error(`CANDIDATES:${JSON.stringify(candidates.map((c) => c.id))}`);

    if (candidates.length === 0) {
      console.error(`No replacement models found in tier "${tier}"`);
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
