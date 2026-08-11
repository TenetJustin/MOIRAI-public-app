# MOIRAI 本地塔罗解读系统

## 数据边界

私有仓库中的 `tarot-database/` 是权威源数据和版权证据。公开应用中的 `app/data/tarot/` 是受审计的运行时副本，只服务离线解读；不得包含生成提示词、编辑历史、授权凭证或原始设计文件。

## cards.json

根节点是 78 个对象组成的数组。必填字段：`id`、`name_cn`、`name_en`、`arcana_type`、`rws_core_meaning`、`upright`、`reversed`、`love`、`career_study`、`wealth`、`relationship`、`self`、`advice`、`greek_character`、`myth_story`、`myth_tarot_connection`。`keywords` 与 `suit` 是运行时索引字段。各问题字段内同时记录正位与逆位的完整可读文本。

## spreads.json

定义单牌、过去／现在／未来三牌、凯尔特十字的位置、位置职责及正逆位修正规则。挑战位即使正位也读取能量的过度、代价或盲点；结果位只描述延续当前路径的条件性趋势。

## interpretation-rules.json

定义问题分类关键词、字段映射、正逆位语义、已批准的组合关系和多牌综合约束。组合规则只有命中预先保存的 card id 集合时才出现，不动态创造未知文本。

## 数据读取流程

1. 根据用户问题在本地匹配问题分类，未命中时使用 general。
2. 使用 Fisher–Yates 洗牌；抽牌时从剩余牌组取牌，天然防止重复。
3. 每张牌独立调用安全随机源生成方向，不维护正逆位配额或人为平衡。
4. 用牌 id 读取 cards.json，再用问题分类选择对应字段并按方向截取文本。
5. 用 spreads.json 的位置职责修正该牌在当前位置的观察角度。
6. 在 interpretation-rules.json 中查找已批准组合，并用固定连接模板形成连续综合。
7. 输出核心牌义、位置解读、组合、希腊神话桥梁、综合回应和行动建议。

## 随机性

浏览器优先使用 `crypto.getRandomValues` 产生均匀随机数，旧环境才回退到 `Math.random`。方向通过独立随机整数的奇偶得到；这在统计意义上仍是公平二项随机，但业务逻辑不设置“本次必须各占一半”的配额。

## 版本与版权

运行数据的 SHA-256 写入私有仓库 `tarot-database/copyright/database-ledger.json`。公开运行时副本必须与权威源文件哈希一致；发布前由测试检查 78 张、字段完整性、唯一 id 和禁用占位文本。
