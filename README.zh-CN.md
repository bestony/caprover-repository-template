# CapRover One-Click App 仓库模板

[English](README.md) | 简体中文

这是一个用于搭建自有 [CapRover](https://caprover.com/) 第三方 One-Click App 商店的模板仓库。

你可以 Fork 本仓库，或 Clone 到本地后使用：在 `templates/` 下添加应用模板并发布生成的目录。CapRover 可以把发布后的站点添加为第三方仓库。

目录站点由 [Eleventy](https://www.11ty.dev/) 和 [Bulma](https://bulma.io/) 构建。GitHub Actions 会校验模板，并将站点部署到 GitHub Pages。

官方文档见：[One-Click Apps](https://caprover.com/docs/one-click-apps.html) 以及 [官方应用仓库](https://github.com/caprover/one-click-apps)。

## 特性

- **预置目录 UI** — 基于 Bulma 的落地页，列出全部应用，并提供 **COPY Repository URL** 按钮，方便填入 CapRover
- **自动发布 GitHub Pages** — 推送到 `main` 后，Actions 会发布 `dist/`
- **自动管理资源** — 应用 logo 发布为 `v4/logos/<app>.png`（JPEG/WebP 会转换，PNG 原样复制）；同时写入 `.nojekyll` 供 Pages 使用
- **自动校验配置** — 本地和 CI 都会检查模板目录结构、CapRover v4 schema、目录合并以及 logo 发布
- **Pre-commit 检查** — Lefthook 在提交前按改动范围运行对应的校验 / 构建 / 测试

## 快速开始

需要 Node.js 18 或更高版本。

```bash
git clone https://github.com/bestony/caprover-repository-template.git
cd caprover-repository-template
npm install
npm start
```

`npm start` 会在本地启动 Eleventy 预览。完整的校验 + 构建 + 验证请使用 `npm test`。

发布步骤：

1. Fork 本仓库（或把本地仓库推送到 GitHub）。
2. 打开仓库 **Settings → Pages → Build and deployment → Source → GitHub Actions**。
3. 推送到 `main`（或手动运行 **CI** workflow）。第一次部署成功后，目录站点即可访问。
4. 打开 Pages URL，点击 **COPY Repository URL**。
5. 在 CapRover 中：**Apps → One-Click Apps/Databases → 3rd party repositories**，粘贴 URL 并连接。

默认 Pages 地址是 `https://<owner>.github.io/<repo>/`。如果仓库名是 `<owner>.github.io`，站点会发布在域名根路径。

## 自定义商店页面

修改 [`config.js`](config.js) 即可更改发布页面的标题和描述。Eleventy 在构建时读取该文件，不必为这两个字段去改模板。

```js
module.exports = {
    title: "CapRover Store",
    description:
        "A minimal CapRover one-click app repository. Point CapRover at this site as a third-party one-click repository.",
    stylesheet: "https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css",
};
```

| 字段 | 用途 |
| --- | --- |
| `title` | HTML `<title>` 和页面主标题 |
| `description` | Meta description 和页面副标题 |
| `stylesheet` | 目录页加载的 Bulma CSS 地址 |

请把 `stylesheet` 保持为 Bulma 样式表。测试和构建校验都假定目录页基于 Bulma。

## 添加应用

每个应用一个目录：

```text
templates/
  mysql/                 # 本模板自带的示例应用
    template.yaml
    logo.png
  my-app/
    template.yaml        # 或 template.yml / template.toml
    logo.png             # 或 logo.jpg / logo.jpeg / logo.webp
```

规则：

- 目录名：小写字母、数字和连字符（`my-app`，不要用 `My_App`）
- 有且仅有一个模板文件：`template.yaml`、`template.yml` 或 `template.toml`
- 有且仅有一个 logo：`logo.png`、`logo.jpg`、`logo.jpeg` 或 `logo.webp`
- `captainVersion` 必须为 `4`
- `services` 至少包含一个服务，且该服务只能定义 `image` 或 `caproverExtra.dockerfileLines` 其中之一
- `caproverOneClickApp` 必须包含 `description`（最多 200 个字符）以及 `instructions.start` / `instructions.end`

可参考自带示例 [`templates/mysql/`](templates/mysql/)。

如果模板里出现下列占位符，构建时会被替换：

| 占位符 | 替换为 |
| --- | --- |
| `$$store_base_url` | 发布站点的 origin（无末尾斜杠） |
| `$$store_logo_url` | 应用 logo 的绝对 URL |
| `$$store_app_url` | 应用定义文件的绝对 URL |

发布后的目录结构符合 CapRover 的约定：

```text
/
  index.html             # 目录 UI
  v4/list                # 目录 JSON
  v4/apps/<name>         # 应用定义 JSON
  v4/logos/<name>.png    # 已发布的 logo
```

## 脚本

| 命令 | 作用 |
| --- | --- |
| `npm start` | Eleventy 开发服务器（`src/` → 预览） |
| `npm run build` | 将静态站点构建到 `dist/` |
| `npm run check` | 校验模板、logo 和目录合并 |
| `npm run verify` | 确认 `dist/` 与目录及站点配置一致 |
| `npm run test:code` | 语法检查和单元测试 |
| `npm test` | 单元测试 + `check` + `build` + `verify` |

`npm install` 会通过 `prepare` 脚本安装 Lefthook。Pre-commit 任务定义在 [`lefthook.yml`](lefthook.yml)：

- 改动 `templates/` → `check` + `build` + `verify`
- 改动 `src/` 或 `eleventy.config.js` → `build` + `verify`
- 改动 JS、测试、`config.js` 或 `package.json` → `test:code`

## 持续集成

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 会在 Pull Request、推送到 `main` 以及手动触发时运行：

1. **validate** — `npm run check` 和 `npm run test:code`
2. **build** — 解析公开的 Pages URL，然后执行 `npm run build` 和 `npm run verify`
3. **deploy** — 仅在 `main` 上，用 `actions/upload-pages-artifact` 上传 `dist/`，再用 `actions/deploy-pages` 发布

自定义域名时可设置以下仓库变量：

| 变量 | 何时设置 |
| --- | --- |
| `SITE_URL` | 公开 origin，例如 `https://apps.example.com` |
| `PATH_PREFIX` | 该 origin 下的路径（站点在域名根路径时用 `/`） |

未设置 `SITE_URL` 时，workflow 会按 GitHub Pages 的 owner/repo 约定推导地址。

## 许可证

本项目使用 [Apache License 2.0](LICENSE)。
