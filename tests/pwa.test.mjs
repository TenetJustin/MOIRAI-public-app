import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const output = new URL("../dist-pwa/", import.meta.url);

test("PWA install resources are complete", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", output), "utf8"));
  assert.equal(manifest.name, "MOIRAI — Oracle of Olympus");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  await readFile(new URL("service-worker.js", output), "utf8");
  await readFile(new URL("icons/icon-192.png", output));
  await readFile(new URL("icons/icon-512.png", output));
});

test("all 78 fronts and corresponding backs ship in the static build", async () => {
  const fronts = (await readdir(new URL("cards/fronts/", output))).filter((name) => name.endsWith(".webp")).sort();
  const backs = (await readdir(new URL("cards/backs/", output))).filter((name) => name.endsWith(".webp")).sort();
  assert.equal(fronts.length, 78);
  assert.equal(backs.length, 78);
  assert.deepEqual(fronts, backs);
});

test("offline manifest includes the complete deployable media set", async () => {
  const assets = JSON.parse(await readFile(new URL("pwa-assets.json", output), "utf8"));
  assert.equal(assets.filter((path) => path.startsWith("./cards/fronts/") && path.endsWith(".webp")).length, 78);
  assert.equal(assets.filter((path) => path.startsWith("./cards/backs/") && path.endsWith(".webp")).length, 78);
  assert.ok(assets.includes("./cards/ritual-back.webp"));
});

test("compiled app preserves the MOIRAI identity and local data controls", async () => {
  const index = await readFile(new URL("index.html", output), "utf8");
  const assets = await readdir(new URL("assets/", output));
  const script = assets.find((name) => name.endsWith(".js"));
  assert.ok(script);
  const bundle = await readFile(new URL(`assets/${script}`, output), "utf8");
  assert.match(index, /MOIRAI/);
  assert.match(index, /manifest\.json/);
  assert.match(bundle, /命运线的回声/);
  assert.match(bundle, /导出备份/);
  assert.match(bundle, /清除本地数据/);
});
