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

The default Pages URL is `https://<owner>.github.io/<repo>/`. If the repository is named `<owner>.github.io`, the site is served at the domain root.

## Customize the store page

Edit [`config.js`](config.js) to change the published page title and description. Eleventy reads this file at build time; you do not need to edit templates for those two fields.

```js
module.exports = {
    title: "CapRover Store",
    description:
        "A minimal CapRover one-click app repository. Point CapRover at this site as a third-party one-click repository.",
    stylesheet: "https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css",
};
```

| Field | Used for |
| --- | --- |
| `title` | HTML `<title>` and the hero heading |
| `description` | Meta description and the hero subtitle |
| `stylesheet` | Bulma CSS URL loaded by the catalog page |

Keep `stylesheet` pointed at a Bulma stylesheet. Tests and the build verifier expect a Bulma-based catalog.

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
2. **build** — resolve the public Pages URL, then `npm run build` and `npm run verify`
3. **deploy** — on `main` only, upload `dist/` with `actions/upload-pages-artifact` and publish with `actions/deploy-pages`

Optional repository variables for a custom domain:

| Variable | When to set |
| --- | --- |
| `SITE_URL` | Public origin, for example `https://apps.example.com` |
| `PATH_PREFIX` | Path under that origin (`/` if the site is at the domain root) |

If `SITE_URL` is unset, the workflow derives the URL from the GitHub Pages owner/repo convention.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
