# IQ 网页测试风格答题器（纯前端）

本项目是一个 **IQ 测试网页风格** 的纯前端答题器，满足：

- **Cloudflare Pages 静态站点**（连接 GitHub 仓库后可直接构建部署）
- **Vite + React + TypeScript**
- 构建输出目录：**`dist`**
- 题库来源：浏览器端读取并解析 **`/dataset.xlsx`**（SheetJS/xlsx）
- 图片来源：**`/images/...`**（点击可放大）
- 公式渲染：支持 MathJax 风格的 `\( ... \)` / `\[ ... \]`（不改写公式，仅渲染）
- 作答持久化：使用 `localStorage`，**答案以“题目 id”作为 key** 保存，刷新不丢进度

---

## Cloudflare Pages 部署（连接 GitHub 后无需本地执行命令）

在 Cloudflare Pages 中 **Create a project → Connect to Git**，选择本仓库后，构建设置如下：

- **Framework preset**：Vite（或 None 也可以）
- **Build command**：`npm run build`
- **Output directory**：`dist`

（Cloudflare Pages 会自动执行 `npm install` 然后运行 Build command）

---

## 静态资源放置（严格按要求实现）

你要求的强制方案已实现：

1) 仓库新增 `public/`
2) 将根目录的资源 **复制** 一份到 `public/`（不移动/不删除原文件）：
   - `public/dataset.xlsx`
   - `public/images/...`
3) Vite 构建时会自动把 `public/` 原样拷贝到 `dist/`
4) 前端运行时通过以下 URL 访问：
   - 题库：`/new.xlsx`（优先）
   - 回退：如果 `/new.xlsx` 不存在，则会尝试 `/output_k12_mcq_zh.xlsx`，最后回退到 `/dataset.xlsx`
   - 图片：`/images/xxx.jpg`（题库中 `Image` 列形如 `images/xxx.jpg`，代码会自动补齐为 `/images/xxx.jpg`）

---

## 本地开发（可选）

如果你想本地运行（非部署必需）：

```bash
npm install
npm run dev
```

---

## 说明：依赖安全告警

本项目按要求使用 `xlsx`（SheetJS）。目前 `npm audit` 可能提示其存在 **已知高危漏洞但“无官方修复版本”** 的告警。
由于本项目只会在浏览器端解析仓库内固定的 `dataset.xlsx`（不接收用户上传文件），风险面已显著降低；如需进一步满足安全合规，可在未来替换为其他兼容解析库（但会违背“必须使用 SheetJS/xlsx”的约束）。

