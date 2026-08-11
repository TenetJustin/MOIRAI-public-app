import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const ignored = new Set(["node_modules", ".git", ".next", ".vinext", ".wrangler", "dist", "dist-pwa", "outputs"]);
const forbiddenPath = /(?:^|\/)(?:prompts?|generation-history|source-files?|original-images?)(?:\/|$)/i;
const forbiddenExtension = /\.(?:psd|psb|ai|xcf|kra|tiff?|raw|dng)$/i;
const secretPattern = /(?:sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,})/g;
const localHomePath = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//g;
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    const short = relative(root, path);
    if (entry.isDirectory()) {
      if (forbiddenPath.test(short)) findings.push(`${short}: private-source directory`);
      else await walk(path);
      continue;
    }
    if (forbiddenExtension.test(short)) findings.push(`${short}: non-deployable source format`);
    const info = await stat(path);
    if (info.size <= 2_000_000 && /\.(?:[cm]?[jt]sx?|json|md|html|css|ya?ml|txt)$/i.test(short)) {
      const content = await readFile(path, "utf8");
      if (secretPattern.test(content)) findings.push(`${short}: possible committed secret`);
      if (localHomePath.test(content)) findings.push(`${short}: local home-directory path`);
      secretPattern.lastIndex = 0;
      localHomePath.lastIndex = 0;
    }
  }
}

await walk(root);
if (findings.length) {
  console.error("Public asset audit failed:\n" + findings.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Public asset audit passed: no master formats, private-source directories, or obvious secrets found.");
}
