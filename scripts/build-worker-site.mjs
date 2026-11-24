import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = dirname(scriptDirectory);
const output = join(root, "dist");
const sitePaths = ["index.html", "index.md", "assets", "css", "pages"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const path of sitePaths) {
  await cp(join(root, path), join(output, path), { recursive: true });
}

console.log(`Built Workers static assets in ${output}`);
