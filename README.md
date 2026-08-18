# CapRover One-Click App Repository Template

English | [简体中文](README.zh-CN.md)

A starter repository for hosting your own [CapRover](https://caprover.com/) third-party One-Click App store.

Fork this repository or clone it locally, add app templates under `templates/`, and publish the generated catalog. CapRover can then connect to the published site as a 3rd-party repository.

The catalog is a static site built with [Eleventy](https://www.11ty.dev/) and [Bulma](https://bulma.io/). GitHub Actions validates templates and deploys the site to GitHub Pages.

See the official CapRover docs: [One-Click Apps](https://caprover.com/docs/one-click-apps.html) and the [official app repository](https://github.com/caprover/one-click-apps).

## Features

- **Preset catalog UI** — a Bulma landing page that lists every app and includes a **COPY Repository URL** button for CapRover
- **Automatic GitHub Pages deploy** — push to `main` and Actions publishes `dist/`
- **Automatic asset management** — app logos are published as `v4/logos/<app>.png` (JPEG/WebP converted; PNG copied as-is); `.nojekyll` is written for Pages
- **Automatic config validation** — template layout, CapRover v4 schema, catalog merge, and logo publish are checked locally and in CI
- **Pre-commit checks** — Lefthook runs the relevant validate / build / test jobs before you commit

## Quick start

Requires Node.js 18 or later.

```bash
git clone https://github.com/bestony/caprover-repository-template.git
cd caprover-repository-template
npm install
npm start
```

`npm start` serves the Eleventy preview locally. Use `npm test` for a full validate + build + verify pass.

To publish:

1. Fork the repository (or push your clone) to GitHub.
2. In the repository: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to `main` (or run the **CI** workflow manually). The first successful deploy publishes the catalog.
4. Open the Pages URL and click **COPY Repository URL**.
5. In CapRover: **Apps → One-Click Apps/Databases → 3rd party repositories**, paste the URL, and connect.

The default Pages URL is `https://<owner>.github.io/<repo>/`. If the repository is named `<owner>.github.io`, the site is served at the domain root. After you fork, set `url` in [`config.js`](config.js) to that published origin so catalog links, logos, and Eleventy's path prefix match the live site.

## Customize the store page

Edit [`config.js`](config.js) to change the published page title, description, keywords, and public site URL. Eleventy reads this file at build time: it writes TDK plus OpenGraph tags, and it uses `url` for catalog links, logo URLs, and the path prefix.

```js
module.exports = {
    title: "CapRover Store",
    description:
        "A minimal CapRover one-click app repository. Point CapRover at this site as a third-party one-click repository.",
    keywords: [
        "CapRover",
        "one-click apps",
        "Docker",
        "self-hosted",
        "app repository",
        "third-party repository",
    ],
    url: "https://bestony.github.io/caprover-repository-template",
    stylesheet: "https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css",
};
```

| Field | Required | Used for |
| --- | --- | --- |
| `title` | yes | HTML `<title>`, hero heading, and `og:title` |
| `description` | yes | Meta description, hero subtitle, and `og:description` |
| `keywords` | yes | Meta keywords (array of non-empty strings) |
| `url` | yes | Public site origin (no trailing slash). Source of catalog links, logo URLs, Eleventy path prefix, canonical URL, and `og:url` |
| `stylesheet` | yes | Bulma CSS URL loaded by the catalog page |
| `ogType` | no | OpenGraph type; defaults to `website` |
| `ogImage` | no | OpenGraph image URL; omitted from HTML when empty |

After you fork the template, set `url` to your published GitHub Pages origin (no trailing slash), for example `https://<owner>.github.io/<repo>`. Change that value again if you move the store or use a custom domain.

`SITE_URL` and `PATH_PREFIX` remain optional environment overrides; the workflow does not set them. Local `npm start` still serves the preview at `/` so path prefixes do not break the dev server.

Keep `stylesheet` pointed at a Bulma stylesheet. Tests and the build verifier expect a Bulma-based catalog with TDK and OpenGraph tags.

## Add an app

Create one directory per app:

```text
templates/
  mysql/                 # example app included in this template
    template.yaml
    logo.png
  my-app/
    template.yaml        # or template.yml / template.toml
    logo.png             # or logo.jpg / logo.jpeg / logo.webp
```

Rules:

- Directory name: lowercase letters, digits, and hyphens (`my-app`, not `My_App`)
- Exactly one template file: `template.yaml`, `template.yml`, or `template.toml`
- Exactly one logo: `logo.png`, `logo.jpg`, `logo.jpeg`, or `logo.webp`
- `captainVersion` must be `4`
- `services` must contain at least one service with either `image` or `caproverExtra.dockerfileLines` (not both)
- `caproverOneClickApp` must include `description` (max 200 characters) and `instructions.start` / `instructions.end`

Use [`templates/mysql/`](templates/mysql/) as a working example.

At build time these placeholders are rewritten if they appear in a template:

| Token | Becomes |
| --- | --- |
| `$$store_base_url` | Published site origin (no trailing slash) |
| `$$store_logo_url` | Absolute URL of the app logo |
| `$$store_app_url` | Absolute URL of the app definition |

The published catalog matches the layout CapRover expects:

```text
/
  index.html             # catalog UI
  v4/list                # catalog JSON
  v4/apps/<name>         # app definition JSON
  v4/logos/<name>.png    # published logo
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Eleventy dev server (`src/` → preview) |
| `npm run build` | Build the static site into `dist/` |
| `npm run check` | Validate templates, logos, and catalog merge |
| `npm run verify` | Assert `dist/` matches the catalog and site config |
| `npm run test:code` | Syntax check and unit tests |
| `npm test` | Unit tests + `check` + `build` + `verify` |

`npm install` installs Lefthook via the `prepare` script. Pre-commit jobs are defined in [`lefthook.yml`](lefthook.yml):

- Changes under `templates/` → `check` + `build` + `verify`
- Changes under `src/` or `eleventy.config.js` → `build` + `verify`
- Changes to JS, tests, `config.js`, or `package.json` → `test:code`

## Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pull requests, pushes to `main`, and manual dispatch:

1. **validate** — `npm run check` and `npm run test:code`
2. **build** — `npm run build` and `npm run verify`, using `url` from `config.js`
3. **deploy** — on `main` only, upload `dist/` with `actions/upload-pages-artifact` and publish with `actions/deploy-pages`

Catalog links, logo URLs, and Eleventy's path prefix come from `config.js` `url`. The workflow does not set `SITE_URL` or `PATH_PREFIX`; those remain optional environment overrides if you need them in a custom job.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
