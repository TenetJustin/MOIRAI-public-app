import type { TarotCardData } from "./deck";

export type OracleCardContext = { card: TarotCardData; position: string };

export type LocalOracleReading = {
  theme: string;
  opening: string;
  threads: { position: string; title: string; text: string }[];
  synthesis: string;
  reflection: string;
};

export type ExternalOracleProvider = "deepseek" | "ollama" | "lmstudio" | "custom";

export type ExternalOracleConfig = {
  provider: ExternalOracleProvider;
  endpoint: string;
  model: string;
  apiKey: string;
};

export const oracleProviderPresets: Record<ExternalOracleProvider, Omit<ExternalOracleConfig, "provider" | "apiKey"> & { label: string; keyHint: string }> = {
  deepseek: {
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    model: "deepseek-chat",
    keyHint: "需要 DeepSeek API Key",
  },
  ollama: {
    label: "Ollama（本机）",
    endpoint: "http://localhost:11434/v1/chat/completions",
    model: "llama3.1",
    keyHint: "通常不需要密钥",
  },
  lmstudio: {
    label: "LM Studio（本机）",
    endpoint: "http://localhost:1234/v1/chat/completions",
    model: "local-model",
    keyHint: "通常不需要密钥",
  },
  custom: {
    label: "其他 OpenAI 兼容接口",
    endpoint: "",
    model: "",
    keyHint: "按接口服务要求填写",
  },
};

const themes = [
  { label: "关系与连接", pattern: /感情|关系|爱|伴侣|婚姻|朋友|对方|他|她|相处|复合/, frame: "关系中的回应、边界和真实需要可能比一个确定结论更值得被看见。" },
  { label: "事业与现实", pattern: /工作|事业|职业|岗位|公司|项目|收入|金钱|创业|升职|换工作/, frame: "现实条件、个人能力与长期方向正在同一个问题中交会。" },
  { label: "选择与方向", pattern: /选择|应该|是否|要不要|方向|决定|留下|离开|继续|放弃|怎么办/, frame: "牌面不会替你决定，但可以照见每条路径正在要求你承担什么。" },
  { label: "情绪与内在", pattern: /情绪|焦虑|害怕|迷茫|痛苦|压力|内心|状态|不安|疲惫/, frame: "当前感受并非障碍本身，它可能正在提示某种尚未被充分承认的需要。" },
  { label: "成长与转变", pattern: /成长|改变|转变|突破|未来|发展|机会|目标|学习|提升/, frame: "变化已经进入视野，但它仍需要节奏、边界与具体行动来获得形状。" },
  { label: "开放的探问", pattern: /.*/, frame: "这个问题仍保留着多种可能，牌面更适合提供观察角度，而不是关闭答案。" },
];

const suitMessages: Record<TarotCardData["suit"], string> = {
  major: "大阿卡纳的比重让这个问题更接近阶段性的转变，而不只是一次短暂选择",
  wands: "权杖的火提示动力、行动和方向正在加速",
  cups: "圣杯的水让情绪、关系与接纳成为主要线索",
  swords: "宝剑的风把注意力带向判断、语言和未被说清的事实",
  pentacles: "星币的土要求答案回到时间、身体、资源与可持续性",
};

function stableIndex(seed: string, length: number) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

function firstSentence(text: string) {
  return text.split(/[。！？]/).filter(Boolean)[0]?.trim() || text;
}

export function createLocalOracleReading(question: string, cards: OracleCardContext[]): LocalOracleReading {
  const theme = themes.find((item) => item.pattern.test(question)) || themes[themes.length - 1];
  const seed = `${question}|${cards.map(({ card, position }) => `${card.id}:${position}`).join("|")}`;
  const openings = [
    "这组牌没有把问题收束成简单的是或否。",
    "命运线在这里呈现的不是结论，而是一组正在彼此影响的力量。",
    "牌面更像一面有雾的镜子：方向已经出现，细节仍需要你亲自辨认。",
  ];
  const counts = cards.reduce<Record<TarotCardData["suit"], number>>((result, { card }) => {
    result[card.suit] += 1;
    return result;
  }, { major: 0, wands: 0, cups: 0, swords: 0, pentacles: 0 });
  const dominantSuit = (Object.keys(counts) as TarotCardData["suit"][]).sort((a, b) => counts[b] - counts[a])[0];
  const anchor = cards[Math.floor(cards.length / 2)] || cards[0];
  const keywords = [...new Set(cards.flatMap(({ card }) => card.keywords))];
  const firstKeyword = keywords[stableIndex(seed, Math.max(keywords.length, 1))] || "真实需要";
  const secondKeyword = keywords[stableIndex(`${seed}:second`, Math.max(keywords.length, 1))] || "下一步";

  return {
    theme: theme.label,
    opening: `${openings[stableIndex(seed, openings.length)]}${theme.frame}`,
    threads: cards.map(({ card, position }) => ({
      position,
      title: `${card.nameZh} · ${card.myth}`,
      text: `${firstSentence(card.interpretation)}。在“${position}”的位置上，它提醒你留意「${card.keywords.slice(0, 2).join("」与「")}」之间的比例。`,
    })),
    synthesis: `${suitMessages[dominantSuit]}。${anchor ? `${anchor.card.nameZh}位于“${anchor.position}”，使「${anchor.card.keywords.join("、")}」成为连接整组牌的中心线索。` : ""} 这并不要求你立刻作出最终决定；较合适的下一步，可能是先确认哪些感受来自当下事实，哪些来自对结果的想象。`,
    reflection: `把原来的问题暂时改写为：在「${firstKeyword}」与「${secondKeyword}」之间，我现在能够诚实回应的最小一步是什么？`,
  };
}

function buildExternalPrompt(question: string, spreadName: string, cards: OracleCardContext[], localReading: LocalOracleReading) {
  const cardLines = cards.map(({ card, position }, index) =>
    `${index + 1}. ${position}：${card.nameZh}（${card.nameEn}）／神话：${card.myth}／关键词：${card.keywords.join("、")}／基础解释：${card.interpretation}`
  ).join("\n");
  return `用户问题：${question}\n牌阵：${spreadName}\n${cardLines}\n\n本地象征解读：${localReading.opening} ${localReading.synthesis}\n\n请用简体中文写一段约350至550字的塔罗综合解读。直接回应用户的问题，但不要给出绝对预言、是非裁决或确定时间；把牌阵位置、希腊神话和牌义连接起来，语气温和、清晰、中性。最后给出一个可以由用户自行回答的反思问题。不要提及你是AI，也不要提供医疗、法律或财务结论。`;
}

export async function requestExternalOracleReading(
  config: ExternalOracleConfig,
  context: { question: string; spreadName: string; cards: OracleCardContext[]; localReading: LocalOracleReading },
) {
  if (!/^https?:\/\//i.test(config.endpoint.trim())) throw new Error("请填写完整的接口地址。");
  if (!config.model.trim()) throw new Error("请填写模型名称。");
  if (config.provider === "deepseek" && !config.apiKey.trim()) throw new Error("DeepSeek 需要 API Key。");

  const response = await fetch(config.endpoint.trim(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model: config.model.trim(),
      messages: [
        { role: "system", content: "你是一名使用希腊神话象征进行自我观照的塔罗解读者。保持开放、中性，不作确定预言。" },
        { role: "user", content: buildExternalPrompt(context.question, context.spreadName, context.cards, context.localReading) },
      ],
      temperature: 0.75,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`接口返回 ${response.status}${detail ? `：${detail.slice(0, 120)}` : ""}`);
  }
  const payload = await response.json() as { choices?: { message?: { content?: string } }[]; message?: { content?: string }; response?: string };
  const content = payload.choices?.[0]?.message?.content || payload.message?.content || payload.response;
  if (!content?.trim()) throw new Error("接口没有返回可显示的解读内容。");
  return content.trim();
}
