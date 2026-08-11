# MOIRAI · ORACLE OF OLYMPUS · 奥林匹斯神谕

MOIRAI 是一款隐私优先、完全在用户设备本地运行的 Greek Mythology Tarot 78 张数字仪式 PWA。

## 产品能力

- 单牌、三牌过去／现在／未来、凯尔特十字仪式
- 78 张完整牌面与 78 张一一对应的文字解释背面
- Three.js 牌桌、Framer Motion 动画与 Web Audio API 环境音
- 78 张牌完整 RWS 正逆位、六类问题与希腊神话桥梁数据库
- 规则驱动的“命运线的回声”本地解读，不连接任何 AI 或第三方接口
- local-first 命运档案，以及备份导出、导入恢复和本地数据清除
- 可安装到手机、iPad 和电脑，支持基础离线访问

## 仓库边界

本仓库只包含网站代码、经优化的展示图片、PWA 资源、部署配置与公开版权说明。

不得提交：原始高清母版、Prompt、PSD/AI/TIFF、生成历史、未发布素材、授权凭证或任何 API Key。这些内容属于独立私有仓库 `MOIRAI-private-assets`。

## 本地开发

```bash
npm ci
npm run dev
```

## 发布前检查

```bash
npm run audit:public
npm run lint
npm run build:standalone
```

纯静态 PWA 输出到 `dist-pwa/`。`.github/workflows/deploy-pages.yml` 可将其部署到 GitHub Pages；仓库设置中需启用 Pages 的 GitHub Actions 来源。私有仓库是否可使用 Pages 取决于 GitHub 账户方案。

## 目录

- `app/`：React 核心交互、78 张牌数据与本地解读逻辑
- `app/data/tarot/`：从私有权威源数据同步的受审计离线运行副本
- `public/cards/`：部署用优化牌面
- `public/icons/`、`public/manifest.json`：PWA 安装资源
- `pwa/service-worker.js`：离线策略源文件
- `docs/`：版权、版本与 local-first 架构说明
- `standalone/`：纯静态 PWA 构建入口

Copyright © 2026 MOIRAI. All rights reserved. 详见 [docs/copyright.md](docs/copyright.md)。
