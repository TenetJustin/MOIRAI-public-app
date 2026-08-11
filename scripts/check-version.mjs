import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
const versionJson = JSON.parse(await readFile(join(root, "public/version.json"), "utf8"));
const copyright = await readFile(join(root, "public/copyright.html"), "utf8");
const versionHistory = await readFile(join(root, "docs/version.md"), "utf8");

assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
assert.equal(packageLock.version, packageJson.version, "package-lock.json root version is out of sync");
assert.equal(packageLock.packages[""].version, packageJson.version, "package-lock.json package version is out of sync");
assert.equal(versionJson.appVersion, packageJson.version, "public/version.json is out of sync");
assert.match(copyright, /id="app-version"/);
assert.match(copyright, /id="build-commit"/);
assert.ok(versionHistory.includes(`## ${packageJson.version} —`), "docs/version.md lacks the current version entry");

const baseRef = process.env.GITHUB_BASE_REF;
if (baseRef) {
  const basePackage = JSON.parse(execFileSync("git", ["show", `origin/${baseRef}:package.json`], { cwd: root, encoding: "utf8" }));
  assert.notEqual(packageJson.version, basePackage.version, `Every release PR must bump package.json version above ${basePackage.version}`);
}

console.log(`Version checks passed for ${packageJson.version}${baseRef ? ` against ${baseRef}` : ""}.`);
