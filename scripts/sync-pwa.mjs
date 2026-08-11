import { readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const versionMeta = JSON.parse(await readFile(join(publicDir, "version.json"), "utf8"));

function currentCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

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

const serviceWorker = await readFile(join(root, "pwa", "service-worker.js"), "utf8");
await writeFile(join(publicDir, "service-worker.js"), serviceWorker.replaceAll("__MOIRAI_APP_VERSION__", packageJson.version), "utf8");
await writeFile(join(publicDir, "pwa-assets.json"), `${JSON.stringify(files, null, 2)}\n`, "utf8");
await writeFile(join(publicDir, "version.json"), `${JSON.stringify({
  ...versionMeta,
  appVersion: packageJson.version,
  buildCommit: currentCommit(),
}, null, 2)}\n`, "utf8");
console.log(`PWA resources synchronized (${files.length} media files, version ${packageJson.version}, commit ${currentCommit()}).`);
