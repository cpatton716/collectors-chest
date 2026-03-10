// .github/scripts/read-models.ts
//
// Reads MODEL_PRIMARY and MODEL_LIGHTWEIGHT from src/lib/models.ts
// and outputs them as JSON to stdout.
// Uses fs.readFileSync + regex instead of dynamic import to avoid tsx loader dependency.
// The regex is targeted to the exact `export const X = "..."` pattern in models.ts.

import * as fs from "fs";
import * as path from "path";

function readModels(): void {
  const modelsPath = path.join(process.cwd(), "src/lib/models.ts");
  const content = fs.readFileSync(modelsPath, "utf-8");

  const primaryMatch = content.match(/export const MODEL_PRIMARY = "([^"]+)"/);
  const lightweightMatch = content.match(/export const MODEL_LIGHTWEIGHT = "([^"]+)"/);

  if (!primaryMatch || !lightweightMatch) {
    console.error("Failed to extract model IDs from models.ts");
    process.exit(1);
  }

  console.log(JSON.stringify({
    MODEL_PRIMARY: primaryMatch[1],
    MODEL_LIGHTWEIGHT: lightweightMatch[1],
  }));
}

readModels();
