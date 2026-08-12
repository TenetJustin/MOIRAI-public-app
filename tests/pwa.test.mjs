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

test("landing page provides a progressive PWA install action", async () => {
  const source = await readFile(new URL("../app/TarotRitual.tsx", import.meta.url), "utf8");
  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /appinstalled/);
  assert.match(source, /安装到手机／电脑桌面/);
  assert.match(source, /iPhone／iPad · Safari/);
  assert.match(source, /Edge／Chrome · 电脑或 Android/);
});

test("the deployed site includes proprietary terms and copyright contact", async () => {
  const terms = await readFile(new URL("terms.html", output), "utf8");
  const copyright = await readFile(new URL("copyright.html", output), "utf8");
  assert.match(terms, /MOIRAI \/ TenetJustin/);
  assert.match(terms, /copyright\.seacoconut@outlook\.com/);
  assert.match(terms, /人工智能与数据集特别限制/);
  assert.match(terms, /检索增强生成（RAG）/);
  assert.match(copyright, /实名身份、创作底稿、源文件、账号归属及权属证明已另行留存/);
});
