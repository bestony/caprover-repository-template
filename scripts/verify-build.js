const fs = require("fs");
const path = require("path");
const { loadApps, toCatalog } = require("../lib/apps");
const logger = require("../lib/logger");
const storeConfig = require("../config");

const DIST_DIR = path.join(__dirname, "..", "dist");

function readJson(filePath) {
    logger.debug("verify", "reading json output", { filePath });
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing build output: ${filePath}`);
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

try {
    const apps = loadApps();
    const list = readJson(path.join(DIST_DIR, "v4", "list"));
    const expected = toCatalog(apps);

    if (JSON.stringify(list) !== JSON.stringify(expected)) {
        logger.error("verify", "v4/list mismatch", { actual: list, expected });
        throw new Error("dist/v4/list does not match the app catalog");
    }

    apps.forEach((app) => {
        const definition = readJson(path.join(DIST_DIR, "v4", "apps", app.name));
        if (String(definition.captainVersion) !== "4") {
            throw new Error(`${app.name} is missing captainVersion 4`);
        }
        if (!definition.services || !definition.caproverOneClickApp) {
            throw new Error(`${app.name} is missing services or caproverOneClickApp`);
        }

        const logoPath = path.join(DIST_DIR, "v4", "logos", app.logoUrl);
        if (!fs.existsSync(logoPath)) {
            throw new Error(`Missing built logo: ${logoPath}`);
        }
        if (path.extname(logoPath) !== ".png") {
            throw new Error(`Published logo must be PNG: ${logoPath}`);
        }
        logger.debug("verify", "app output ok", {
            name: app.name,
            definitionPath: path.join("dist", "v4", "apps", app.name),
            logoPath: path.join("dist", "v4", "logos", app.logoUrl),
        });
    });

    const catalogPage = path.join(DIST_DIR, "index.html");
    if (!fs.existsSync(catalogPage)) {
        throw new Error("Missing catalog page dist/index.html");
    }

    const catalogHtml = fs.readFileSync(catalogPage, "utf8");
    logger.debug("verify", "checking catalog page copy and Bulma markup", {
        title: storeConfig.title,
        description: storeConfig.description,
        stylesheet: storeConfig.stylesheet,
    });
    if (!catalogHtml.includes(storeConfig.title)) {
        throw new Error("dist/index.html is missing config.js title");
    }
    if (!catalogHtml.includes(storeConfig.description)) {
        throw new Error("dist/index.html is missing config.js description");
    }
    if (!catalogHtml.includes(storeConfig.stylesheet)) {
        throw new Error("dist/index.html is missing the Bulma stylesheet from config.js");
    }
    if (/<style[\s>]/i.test(catalogHtml)) {
        throw new Error("dist/index.html must not include custom CSS");
    }
    ["hero is-link", "section", "box", "media"].forEach((className) => {
        if (!catalogHtml.includes(`class="${className}`)) {
            throw new Error(`dist/index.html is missing Bulma class ${className}`);
        }
    });
    if (apps.some((app) => app.isOfficial) && !catalogHtml.includes("tag is-info is-light")) {
        throw new Error("dist/index.html is missing the official-image Bulma tag");
    }
    if (!catalogHtml.includes('id="copy-repository-url"') || !catalogHtml.includes("COPY Repository URL")) {
        throw new Error("dist/index.html is missing the COPY Repository URL button");
    }
    if (catalogHtml.includes("Definition:") || /Logo:\s*</.test(catalogHtml)) {
        throw new Error("dist/index.html should not list per-app Definition or Logo links");
    }
    if (catalogHtml.includes("Catalog JSON") || /class="footer"/.test(catalogHtml)) {
        throw new Error("dist/index.html should not include the Catalog JSON footer");
    }

    const nojekyll = path.join(DIST_DIR, ".nojekyll");
    if (!fs.existsSync(nojekyll)) {
        throw new Error("Missing dist/.nojekyll for GitHub Pages");
    }

    logger.info("verify", "build output verified", {
        apps: apps.map((app) => app.name),
        listPath: "dist/v4/list",
    });
} catch (error) {
    logger.error("verify", "build verification failed", { error: error.message });
    process.exit(1);
}
