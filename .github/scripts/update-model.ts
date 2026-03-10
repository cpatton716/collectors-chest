// .github/scripts/update-model.ts
//
// Updates src/lib/models.ts with a new model ID.
// Uses full export line matching for targeted replacement:
//   export const MODEL_PRIMARY = "old-id" -> export const MODEL_PRIMARY = "new-id"
// CONSTANT_NAME env var determines which constant to update.
// Exit 0 = success. Exit 1 = model ID not found in file.

import * as fs from "fs";
import * as path from "path";

const OLD_MODEL = process.env.OLD_MODEL_ID;
const NEW_MODEL = process.env.NEW_MODEL_ID;
const CONSTANT_NAME = process.env.CONSTANT_NAME;

if (!OLD_MODEL || !NEW_MODEL || !CONSTANT_NAME) {
  console.error("Missing OLD_MODEL_ID, NEW_MODEL_ID, or CONSTANT_NAME");
  process.exit(2);
}

const modelsPath = path.join(process.cwd(), "src/lib/models.ts");

if (!fs.existsSync(modelsPath)) {
  console.error(`File not found: ${modelsPath}`);
  process.exit(1);
}

const content = fs.readFileSync(modelsPath, "utf-8");

const oldLine = `export const ${CONSTANT_NAME} = "${OLD_MODEL}";`;
const newLine = `export const ${CONSTANT_NAME} = "${NEW_MODEL}";`;

if (!content.includes(oldLine)) {
  console.error(
    `Expected line not found in ${modelsPath}:\n  ${oldLine}`
  );
  process.exit(1);
}

const updated = content.replace(oldLine, newLine);

if (updated === content) {
  console.error("No changes made — replacement had no effect");
  process.exit(1);
}

fs.writeFileSync(modelsPath, updated, "utf-8");
console.log(`Updated ${CONSTANT_NAME}: ${OLD_MODEL} -> ${NEW_MODEL}`);
process.exit(0);
