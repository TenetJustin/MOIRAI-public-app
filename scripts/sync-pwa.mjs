import { copyFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

const mediaRoots = [join(publicDir, "cards"), join(publicDir, "landing")];
const files = (await Promise.all(mediaRoots.map(walk))).flat()
  .filter((path) => /\.(?:webp|png|jpe?g|svg)$/i.test(path))
  .map((path) => `./${relative(publicDir, path).split("\\").join("/")}`)
  .sort();

await copyFile(join(root, "pwa", "service-worker.js"), join(publicDir, "service-worker.js"));
await writeFile(join(publicDir, "pwa-assets.json"), `${JSON.stringify(files, null, 2)}\n`, "utf8");
console.log(`PWA resources synchronized (${files.length} media files).`);
