import fs from "fs";
import path from "path";

export function getDataDir(): string {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
