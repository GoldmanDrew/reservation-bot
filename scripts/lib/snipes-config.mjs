import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = path.join(__dirname, "..", "..", "config", "snipes.yaml");

export function loadSnipesDoc() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { snipes: [] };
  }
  const doc = yaml.load(fs.readFileSync(CONFIG_PATH, "utf-8"));
  return { snipes: doc?.snipes ?? [] };
}

export function saveSnipesDoc(doc) {
  const content = yaml.dump(doc, { lineWidth: 100, noRefs: true });
  fs.writeFileSync(CONFIG_PATH, content, "utf-8");
}

export function loadEnabledSnipes() {
  return loadSnipesDoc().snipes.filter((s) => s.enabled !== false);
}

export function upsertSnipe(snipe) {
  const doc = loadSnipesDoc();
  const idx = doc.snipes.findIndex((s) => s.id === snipe.id);
  if (idx >= 0) doc.snipes[idx] = snipe;
  else doc.snipes.push(snipe);
  saveSnipesDoc(doc);
  return snipe;
}

export function disableSnipe(id) {
  const doc = loadSnipesDoc();
  let changed = false;
  for (const s of doc.snipes) {
    if (s.id === id && s.enabled !== false) {
      s.enabled = false;
      changed = true;
    }
  }
  if (changed) saveSnipesDoc(doc);
  return changed;
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function makeSnipeId(name, targetDate) {
  return `${slugify(name)}-${targetDate}`;
}
