import cardsJson from "./data/tarot/cards.json";
import rulesJson from "./data/tarot/interpretation-rules.json";
import spreadsJson from "./data/tarot/spreads.json";
import type { SpreadKey, TarotCardData } from "./deck";

export type CardOrientation = "upright" | "reversed";
export type QuestionCategory = "love" | "career" | "wealth" | "relationship" | "self" | "general";
export type OracleCardContext = { card: TarotCardData; position: string; orientation: CardOrientation };

type TarotDatabaseCard = {
  id: string;
  name_cn: string;
  name_en: string;
  arcana_type: string;
  rws_core_meaning: string;
  upright: string;
  reversed: string;
  love: string;
  career_study: string;
  wealth: string;
  relationship: string;
  self: string;
  advice: string;
  greek_character: string;
  myth_story: string;
  myth_tarot_connection: string;
  keywords: string[];
  suit: TarotCardData["suit"];
};

type CategoryRule = { label: string; field: keyof TarotDatabaseCard; patterns: string[] };
type PositionRule = { id: string; name_cn: string; role: string; upright_rule: string; reversed_rule: string };
type SpreadRule = { name_cn: string; count: number; positions: PositionRule[]; synthesis: { opening: string; connectors?: string[]; groups?: string[][] } };
type CombinationRule = { type: "reinforcement" | "conflict" | "transformation"; cards: string[]; title: string; text: string };

export type LocalOracleReading = {
  category: QuestionCategory;
  theme: string;
  opening: string;
  coreMeaning: string;
  threads: { position: string; title: string; orientation: CardOrientation; text: string; myth: string }[];
  combinations: { type: string; title: string; text: string }[];
  synthesis: string;
  greekBridge: string;
  advice: string;
};

const database = cardsJson as TarotDatabaseCard[];
const databaseById = new Map(database.map((card) => [card.id, card]));
const categoryRules = rulesJson.question_categories as Record<QuestionCategory, CategoryRule>;
const spreadRules = spreadsJson.spreads as Record<SpreadKey, SpreadRule>;
const combinationRules = rulesJson.combinations as CombinationRule[];

export function secureRandomUnit() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] / 0x1_0000_0000;
  }
  return Math.random();
}

export function randomOrientation(): CardOrientation {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return (value[0] & 1) === 0 ? "upright" : "reversed";
  }
  return Math.floor(Math.random() * 0x1_0000_0000) % 2 === 0 ? "upright" : "reversed";
}

export function shuffleDeckSecure<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(secureRandomUnit() * (index + 1));
    [next[index], next[selected]] = [next[selected], next[index]];
  }
  return next;
}

export function classifyQuestion(question: string): QuestionCategory {
  const normalized = question.trim().toLowerCase();
  const categories = Object.entries(categoryRules) as [QuestionCategory, CategoryRule][];
  return categories.find(([key, rule]) => key !== "general" && rule.patterns.some((pattern) => normalized.includes(pattern)))?.[0] ?? "general";
}

function selectDirectedText(value: string, orientation: CardOrientation) {
  const uprightMarker = "正位：";
  const reversedMarker = "；逆位：";
  if (!value.includes(uprightMarker) || !value.includes(reversedMarker)) return value;
  const [upright, reversed] = value.slice(uprightMarker.length).split(reversedMarker);
  return orientation === "upright" ? upright : reversed;
}

function getTopicText(card: TarotDatabaseCard, category: QuestionCategory, orientation: CardOrientation) {
  if (category === "general") return orientation === "upright" ? card.upright : card.reversed;
  return selectDirectedText(String(card[categoryRules[category].field]), orientation);
}

function getPositionRule(spread: SpreadKey, index: number) {
  return spreadRules[spread].positions[index] ?? spreadRules[spread].positions[0];
}

function findCombinations(cards: OracleCardContext[]) {
  const ids = new Set(cards.map(({ card }) => card.id));
  return combinationRules.filter((rule) => rule.cards.every((id) => ids.has(id)));
}

function buildSynthesis(spread: SpreadKey, threads: LocalOracleReading["threads"], combinations: CombinationRule[]) {
  if (spread === "single") {
    return `这张牌把问题集中在“${threads[0]?.position ?? "当前状态"}”：${threads[0]?.text ?? "请重新抽牌。"}`;
  }
  if (spread === "three") {
    const connectors = spreadRules.three.synthesis.connectors ?? ["过去形成了", "因此现在", "若保持当前路径，未来更可能"];
    return threads.map((thread, index) => `${connectors[index]}：${thread.text}`).join(" ") + (combinations.length ? ` 组合规则进一步指出：${combinations.map((item) => item.text).join(" ")}` : "");
  }
  const groups = spreadRules.celtic.synthesis.groups ?? [];
  const grouped = groups.map((_, index) => {
    const left = threads[index * 2];
    const right = threads[index * 2 + 1];
    return left && right ? `${left.position}与${right.position}共同显示：${left.text} 同时，${right.text}` : "";
  }).filter(Boolean);
  return `${spreadRules.celtic.synthesis.opening}。${grouped.join(" ")}${combinations.length ? ` 已命中的组合关系：${combinations.map((item) => item.text).join(" ")}` : ""}`;
}

export function createLocalOracleReading(question: string, spread: SpreadKey, cards: OracleCardContext[]): LocalOracleReading {
  const category = classifyQuestion(question);
  const threads = cards.map(({ card, position, orientation }, index) => {
    const data = databaseById.get(card.id);
    if (!data) throw new Error(`塔罗数据库缺少牌：${card.id}`);
    const positionRule = getPositionRule(spread, index);
    const topicText = getTopicText(data, category, orientation);
    const modifier = orientation === "upright" ? positionRule.upright_rule : positionRule.reversed_rule;
    return {
      position,
      title: `${data.name_cn} · ${data.name_en}`,
      orientation,
      text: `${positionRule.role}。${modifier}：${topicText}`,
      myth: data.myth_tarot_connection,
    };
  });
  const combinations = findCombinations(cards);
  const first = cards[0] ? databaseById.get(cards[0].card.id) : undefined;
  return {
    category,
    theme: categoryRules[category].label,
    opening: `${spreadRules[spread].synthesis.opening}。本次解读依据“${categoryRules[category].label}”问题字段、牌阵位置与正逆位规则。`,
    coreMeaning: first?.rws_core_meaning ?? "",
    threads,
    combinations,
    synthesis: buildSynthesis(spread, threads, combinations),
    greekBridge: threads.map((thread) => `${thread.position}：${thread.myth}`).join(" "),
    advice: cards.map(({ card }) => databaseById.get(card.id)?.advice).filter((value, index, all) => value && all.indexOf(value) === index).slice(0, spread === "celtic" ? 3 : 2).join(" "),
  };
}

export function getDatabaseCard(id: string) {
  return databaseById.get(id);
}

export const tarotDatabaseSize = database.length;
