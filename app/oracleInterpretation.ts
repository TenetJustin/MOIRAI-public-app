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
  causalChain: string;
  commonTheme: string;
  priorities: string[];
  actions: string[];
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

function cardSignal(card: TarotDatabaseCard, orientation: CardOrientation) {
  const [primary, secondary = primary] = card.keywords;
  return orientation === "upright"
    ? `「${primary}」是可直接运用的资源，并需以「${secondary}」落实`
    : `「${primary}」目前表现为阻塞、缺失或过量，需先校正「${secondary}」`;
}

function describeCard(context: OracleCardContext) {
  const data = databaseById.get(context.card.id);
  if (!data) throw new Error(`塔罗数据库缺少牌：${context.card.id}`);
  return `${data.name_cn}${context.orientation === "upright" ? "正位" : "逆位"}所指的${cardSignal(data, context.orientation)}`;
}

function buildCausalChain(spread: SpreadKey, cards: OracleCardContext[]) {
  if (spread === "single") {
    return `当前问题集中在${describeCard(cards[0])}。先辨认这一状态在现实中的具体表现，再决定是运用资源还是处理阻塞。`;
  }
  if (spread === "three") {
    return `过去，${describeCard(cards[0])}，形成了当前局面的基础；现在，${describeCard(cards[1])}，显示旧影响正在怎样进入选择；若不改变现有做法，${describeCard(cards[2])}会成为下一阶段较可能出现的趋势。未来牌描述的是条件性方向，不是确定结果。`;
  }
  return `当前状态由${describeCard(cards[0])}呈现，并受到${describeCard(cards[1])}的直接牵制；其深层来源连接${describeCard(cards[2])}与${describeCard(cards[3])}。潜在可能和近期发展分别由${describeCard(cards[4])}、${describeCard(cards[5])}给出；随后，自我态度与外部环境的互动决定希望与恐惧会否把局面推向${describeCard(cards[9])}所示的条件性结果。`;
}

function buildCommonTheme(cards: OracleCardContext[], combinations: CombinationRule[]) {
  const data = cards.map(({ card }) => databaseById.get(card.id)).filter((card): card is TarotDatabaseCard => Boolean(card));
  const reversed = cards.filter(({ orientation }) => orientation === "reversed").length;
  const major = data.filter((card) => card.arcana_type === "major").length;
  const keywordCounts = new Map<string, number>();
  data.flatMap((card) => card.keywords).forEach((keyword) => keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1));
  const shared = [...keywordCounts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).map(([keyword]) => keyword).slice(0, 3);
  const orientationTheme = reversed > cards.length / 2
    ? "多数牌为逆位，当前重点是清理阻塞、过量与缺失，而非强行推进。"
    : reversed === cards.length / 2
      ? "正逆位力量接近，外在推进必须与内在调整同步。"
      : "多数牌为正位，可用资源较多，但仍需通过现实反馈验证。";
  const majorTheme = major >= Math.ceil(cards.length / 2) ? "大阿尔卡那占比较高，问题涉及长期模式或重要阶段选择。" : "小阿尔卡那占比较高，改变更依赖日常行为、沟通和资源安排。";
  const sharedTheme = shared.length ? `重复出现的关键词是${shared.map((item) => `「${item}」`).join("、")}，这是各位置共同指向的主题。` : `各牌没有重复关键词，重点在于协调${data.slice(0, 3).map((card) => `「${card.keywords[0]}」`).join("、")}之间的关系。`;
  const combinationTheme = combinations.length ? `已命中的牌组关系为${combinations.map((item) => `「${item.title}」`).join("、")}。` : "本次没有命中预设的特殊牌组关系，按位置链条判断即可。";
  return `${orientationTheme}${majorTheme}${sharedTheme}${combinationTheme}`;
}

const categoryActions: Record<QuestionCategory, [string, string]> = {
  love: ["写下自己的需要、边界与可接受的回应，各保留一条", "进行一次只讨论事实和下一步的沟通，不用猜测替代对方的明确回应"],
  career: ["把目标缩成一个七天内可验收的成果，并写明完成标准", "确认当前最缺的一项资源、能力或授权，只补这一项后再推进"],
  wealth: ["核对现金流、固定支出、合同与风险暴露，不把期待收益计入可用金额", "设定一项金额明确的调整，并在七天后复查实际结果"],
  relationship: ["列出自己、他人和共同责任，删除无法由自己控制的任务", "安排一次角色与边界确认，并记录双方同意的下一步"],
  self: ["连续三天记录事实、感受、需要和行动，区分观察与推测", "选择一个十分钟内可以开始的小行动，用完成记录代替自我评价"],
  general: ["写下当前事实、自己的需要和能够控制的下一步", "选择一个七天内可完成且结果可观察的行动，再按反馈调整"],
};

function buildPriorities(spread: SpreadKey, cards: OracleCardContext[]) {
  const indices = spread === "single" ? [0] : spread === "three" ? [1, 0, 2] : [1, 2, 0, 6, 7, 5, 9];
  const labels = spread === "single"
    ? ["先处理核心"]
    : spread === "three"
      ? ["第一优先：处理当下", "第二优先：整合过去", "第三优先：校准趋势"]
      : ["第一优先：解除主要阻碍", "第二优先：处理深层原因", "第三优先：稳定当前状态", "第四优先：调整自身态度", "第五优先：核对外部条件", "第六优先：观察近期发展", "最后：再评估结果"];
  return indices.map((cardIndex, index) => `${labels[index]}——${describeCard(cards[cardIndex])}。`);
}

function buildActions(spread: SpreadKey, category: QuestionCategory, cards: OracleCardContext[]) {
  const [firstAction, secondAction] = categoryActions[category];
  const focusIndex = spread === "single" ? 0 : spread === "three" ? 1 : 1;
  const focus = databaseById.get(cards[focusIndex].card.id);
  const resultIndex = spread === "celtic" ? 9 : cards.length - 1;
  const result = databaseById.get(cards[resultIndex].card.id);
  return [
    `直接行动：围绕${focus?.name_cn ?? "核心牌"}的「${focus?.keywords[0] ?? "核心主题"}」，${firstAction}。`,
    `后续行动：${secondAction}。`,
    `调整原则：以「${result?.keywords[0] ?? "结果"}」是否更清楚、更稳定作为反馈；若没有改善，先调整方法或补足条件，不把趋势当作定论。`,
  ];
}

function buildSynthesis(causalChain: string, commonTheme: string) {
  return `${causalChain} ${commonTheme}`;
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
  const causalChain = buildCausalChain(spread, cards);
  const commonTheme = buildCommonTheme(cards, combinations);
  const priorities = buildPriorities(spread, cards);
  const actions = buildActions(spread, category, cards);
  return {
    category,
    theme: categoryRules[category].label,
    opening: `${spreadRules[spread].synthesis.opening}。本次解读依据“${categoryRules[category].label}”问题字段、牌阵位置与正逆位规则。`,
    coreMeaning: first?.rws_core_meaning ?? "",
    threads,
    combinations,
    synthesis: buildSynthesis(causalChain, commonTheme),
    causalChain,
    commonTheme,
    priorities,
    actions,
    greekBridge: threads.map((thread) => `${thread.position}：${thread.myth}`).join(" "),
    advice: actions.join(" "),
  };
}

export function getDatabaseCard(id: string) {
  return databaseById.get(id);
}

export const tarotDatabaseSize = database.length;
