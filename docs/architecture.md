# Local-first 架构

MOIRAI 1.0 是纯前端 PWA。页面、78 张牌面和离线缓存均随静态发布包交付。

## 当前数据边界

- 命运档案：`localStorage / olympus-tarot-archive`
- 收藏预留：`localStorage / moirai-favorites`
- 设置预留：`localStorage / moirai-settings`
- 自带模型连接：仅当前会话 `sessionStorage / moirai-oracle-connection`

数据不会自动上传。用户可在“命运档案”页面导出完整 JSON 备份、导入恢复或清除本地数据。

## 未来扩展边界

账户授权、购买解锁、多设备同步和托管 AI 必须作为独立的可选模块加入，并在启用前取得用户明确授权。不得把远端同步写入现有 local-first 数据层；应通过版本化适配器读取 `schema 1` 备份，再由用户决定上传范围。

任何发布版本都不得连接或配置 OpenAI、DeepSeek、Ollama、LM Studio 或其他生成式 AI 接口。所有输出只来自随应用发布的 78 张牌运行数据库、牌阵位置规则、正逆位规则与预先批准的组合文本。

私有仓库 `tarot-database/` 保留权威源数据、版权证据和 SHA-256 台账。公开仓库的 `app/data/tarot/` 仅是离线应用必须加载的受审计运行副本，不包含生成提示词、修订记录、设计源文件或授权凭证。
