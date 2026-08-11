import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const tarotData = new URL("../app/data/tarot/", import.meta.url);
const requiredFields = [
  "id", "name_cn", "name_en", "arcana_type", "rws_core_meaning", "upright", "reversed",
  "love", "career_study", "wealth", "relationship", "self", "advice", "greek_character",
  "myth_story", "myth_tarot_connection",
];

async function json(name) {
  return JSON.parse(await readFile(new URL(name, tarotData), "utf8"));
}

test("runtime tarot database contains 78 complete, unique cards", async () => {
  const cards = await json("cards.json");
  assert.equal(cards.length, 78);
  assert.equal(new Set(cards.map((card) => card.id)).size, 78);
  for (const card of cards) {
    for (const field of requiredFields) {
      assert.equal(typeof card[field], "string", `${card.id}.${field} must be text`);
      assert.ok(card[field].trim().length >= 2, `${card.id}.${field} must not be empty`);
    }
    assert.match(card.love, /^正位：.+；逆位：.+$/);
    assert.match(card.career_study, /^正位：.+；逆位：.+$/);
    assert.doesNotMatch(JSON.stringify(card), /根据(?:爱情|事业|财富|人际|自我).{0,8}(?:解释|进行解释)/);
  }
});

test("spread positions and question categories are complete", async () => {
  const spreads = await json("spreads.json");
  const rules = await json("interpretation-rules.json");
  assert.equal(spreads.spreads.single.positions.length, 1);
  assert.equal(spreads.spreads.three.positions.length, 3);
  assert.equal(spreads.spreads.celtic.positions.length, 10);
  assert.deepEqual(Object.keys(rules.question_categories), ["love", "career", "wealth", "relationship", "self", "general"]);
  assert.ok(rules.combinations.some((rule) => rule.cards.includes("m19") && rule.cards.includes("m21")));
  assert.ok(rules.combinations.some((rule) => rule.cards.includes("m15") && rule.cards.includes("m11")));
  assert.ok(rules.combinations.some((rule) => rule.cards.includes("m13") && rule.cards.includes("m17")));
});

test("application contains no external oracle implementation", async () => {
  const source = await readFile(new URL("../app/oracleInterpretation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /apiKey|chat\/completions|OpenAI|DeepSeek|Ollama|LM Studio/i);
  assert.match(source, /function buildCausalChain/);
  assert.match(source, /function buildCommonTheme/);
  assert.match(source, /function buildPriorities/);
  assert.match(source, /function buildActions/);
  assert.match(source, /过去.*形成了当前局面的基础.*现在.*旧影响正在怎样进入选择/s);
  assert.match(source, /当前状态由.*直接牵制.*深层来源.*自我态度与外部环境/s);
  assert.match(source, /直接行动：.*后续行动：.*调整原则：/s);
  assert.doesNotMatch(source, /今天：|七天内：|复查条件：/);
});

test("every new ritual entry resets prior ritual state", async () => {
  const source = await readFile(new URL("../app/TarotRitual.tsx", import.meta.url), "utf8");
  assert.match(source, /const startNewRitual = \(\) => \{ resetRitualState\(\); go\("intention"\); \}/);
  assert.match(source, /setQuestion\(""\); setSpread\("single"\); setPurified\(false\); setShuffleCount\(0\)/);
  assert.match(source, /setRemaining\(\[\]\); setDrawn\(\[\]\); setCutPile\(null\); setSaved\(false\)/);
  assert.doesNotMatch(source, /onClick=\{\(\) => go\("intention"\)\}/);
});
