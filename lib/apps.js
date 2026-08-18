const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const toml = require("@iarna/toml");
const logger = require("./logger");

const PROJECT_ROOT = path.join(__dirname, "..");
const TEMPLATES_DIR = path.join(PROJECT_ROOT, "templates");

const TEMPLATE_FILES = ["template.yaml", "template.yml", "template.toml"];
const LOGO_FILES = ["logo.png", "logo.jpg", "logo.jpeg", "logo.webp"];

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function storeBaseUrl(explicitBaseUrl) {
    const raw = explicitBaseUrl !== undefined ? explicitBaseUrl : process.env.SITE_URL;
    return String(raw || "").replace(/\/+$/, "");
}

function storePathPrefix(explicitPathPrefix) {
    const raw =
        explicitPathPrefix !== undefined ? explicitPathPrefix : process.env.PATH_PREFIX;
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed === "/") {
        return "";
    }
    return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function publishedBaseUrl(options = {}) {
    return storeBaseUrl(options.baseUrl) || storePathPrefix(options.pathPrefix);
}

function publicUrl(pathname, baseUrl) {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${storeBaseUrl(baseUrl)}${normalizedPath}`;
}

function existingFiles(dir, fileNames) {
    return fileNames
        .map((fileName) => path.join(dir, fileName))
        .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile());
}

function listTemplateDirs(templatesDir = TEMPLATES_DIR) {
    if (!fs.existsSync(templatesDir)) {
        logger.error("apps", "templates directory missing", { templatesDir });
        throw new Error(`Templates directory not found: ${templatesDir}`);
    }

    const entries = fs.readdirSync(templatesDir, { withFileTypes: true });
    logger.debug("apps", "templates directory listing", {
        templatesDir,
        entries: entries.map((entry) => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
        })),
    });

    return entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

function parseDefinition(raw, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    logger.debug("apps", "parsing template", { filePath, ext, bytes: Buffer.byteLength(raw) });

    if (ext === ".yaml" || ext === ".yml") {
        return yaml.load(raw);
    }
    if (ext === ".toml") {
        return toml.parse(raw);
    }

    throw new Error(`Unsupported template format for ${filePath}`);
}

function rewriteStoreUrls(value, replacements, trail = "") {
    if (typeof value === "string") {
        let rewritten = value;
        Object.entries(replacements).forEach(([token, replacement]) => {
            if (rewritten.includes(token)) {
                logger.debug("apps", "rewriting store url token", {
                    trail,
                    token,
                    replacement,
                });
                rewritten = rewritten.split(token).join(replacement);
            }
        });
        return rewritten;
    }

    if (Array.isArray(value)) {
        return value.map((item, index) =>
            rewriteStoreUrls(item, replacements, `${trail}[${index}]`)
        );
    }

    if (value && typeof value === "object") {
        const next = {};
        Object.entries(value).forEach(([key, child]) => {
            next[key] = rewriteStoreUrls(child, replacements, trail ? `${trail}.${key}` : key);
        });
        return next;
    }

    return value;
}

function validateApp(name, definition) {
    const captainVersion = String(definition.captainVersion);
    logger.debug("apps", "validating captainVersion", { name, captainVersion });
    if (captainVersion !== "4") {
        throw new Error(`unmatched versions 4 ${captainVersion} for ${name}`);
    }

    const meta = definition.caproverOneClickApp;
    if (!meta) {
        throw new Error(`Cannot find caproverOneClickApp for ${name}`);
    }
    if (!meta.description) {
        throw new Error(`Cannot find description for ${name}`);
    }
    if (meta.description.length > 200) {
        throw new Error(`Description too long for ${name} - keep it below 200 chars`);
    }
    if (!meta.instructions || !meta.instructions.start || !meta.instructions.end) {
        throw new Error(`Cannot find instructions.start or instructions.end for ${name}`);
    }
    if (!definition.services || typeof definition.services !== "object") {
        throw new Error(`Cannot find services for ${name}`);
    }

    const serviceNames = Object.keys(definition.services);
    logger.debug("apps", "services discovered", { name, serviceNames });
    if (serviceNames.length === 0) {
        throw new Error(`services must contain at least one service for ${name}`);
    }

    serviceNames.forEach((serviceName) => {
        const service = definition.services[serviceName];
        const hasImage = Boolean(service && service.image);
        const hasDockerfile = Boolean(
            service && service.caproverExtra && service.caproverExtra.dockerfileLines
        );
        logger.debug("apps", "service inspect", {
            name,
            serviceName,
            hasImage,
            hasDockerfile,
            image: service && service.image,
            notExposeAsWebApp:
                service && service.caproverExtra && service.caproverExtra.notExposeAsWebApp,
        });
        if (!hasImage && !hasDockerfile) {
            throw new Error(
                `Service ${serviceName} in ${name} must define image or caproverExtra.dockerfileLines`
            );
        }
        if (hasImage && hasDockerfile) {
            throw new Error(
                `Service ${serviceName} in ${name} cannot define both image and dockerfileLines`
            );
        }
    });

    if (Array.isArray(meta.variables)) {
        meta.variables.forEach((variable, index) => {
            if (!variable || !variable.id || !variable.label) {
                throw new Error(
                    `Variable at index ${index} in ${name} must have id and label`
                );
            }
            if (!String(variable.id).startsWith("$$cap")) {
                throw new Error(
                    `Variable id must start with $$cap in ${name}: ${variable.id}`
                );
            }
            logger.debug("apps", "variable ok", {
                name,
                id: variable.id,
                hasDefault: variable.defaultValue !== undefined,
                hasRegex: Boolean(variable.validRegex),
            });
        });
    }
}

function loadTemplateApp(name, options = {}) {
    const templatesDir = options.templatesDir || TEMPLATES_DIR;
    const appDir = path.join(templatesDir, name);
    const templateFiles = existingFiles(appDir, TEMPLATE_FILES);
    const logoFiles = existingFiles(appDir, LOGO_FILES);

    logger.info("apps", "loading template directory", {
        name,
        appDir,
        templateFiles,
        logoFiles,
    });

    if (templateFiles.length === 0) {
        throw new Error(
            `Missing template.yaml, template.yml, or template.toml in templates/${name}/`
        );
    }
    if (templateFiles.length > 1) {
        throw new Error(
            `Multiple template files in templates/${name}/: ${templateFiles
                .map((filePath) => path.basename(filePath))
                .join(", ")}`
        );
    }
    if (logoFiles.length === 0) {
        throw new Error(
            `Missing logo.png, logo.jpg, or logo.webp in templates/${name}/`
        );
    }
    if (logoFiles.length > 1) {
        throw new Error(
            `Multiple logo files in templates/${name}/: ${logoFiles
                .map((filePath) => path.basename(filePath))
                .join(", ")}`
        );
    }

    const templatePath = templateFiles[0];
    const logoSourcePath = logoFiles[0];
    const raw = fs.readFileSync(templatePath, "utf8");

    let definition;
    try {
        definition = parseDefinition(raw, templatePath);
    } catch (error) {
        logger.error("apps", "template parse failed", {
            name,
            templatePath,
            error: error.message,
        });
        throw error;
    }

    if (!definition || typeof definition !== "object") {
        throw new Error(`Invalid template object for ${name}`);
    }

    validateApp(name, definition);

    const baseUrl = publishedBaseUrl(options);
    const logoUrl = `${name}.png`;
    const logoPath = publicUrl(`/v4/logos/${logoUrl}`, baseUrl);
    const publishedDefinition = rewriteStoreUrls(definition, {
        "$$store_base_url": baseUrl,
        "$$store_logo_url": logoPath,
        "$$store_app_url": publicUrl(`/v4/apps/${name}`, baseUrl),
    });

    const meta = publishedDefinition.caproverOneClickApp;
    const app = {
        name,
        displayName: meta.displayName || capitalize(name),
        description: meta.description || "",
        isOfficial: String(meta.isOfficial).toLowerCase().trim() === "true",
        logoUrl,
        logoPath,
        logoSourcePath,
        templatePath,
        definition: publishedDefinition,
    };

    logger.info("apps", "template published", {
        name: app.name,
        displayName: app.displayName,
        isOfficial: app.isOfficial,
        templatePath,
        logoSourcePath,
        logoUrl,
        logoPath,
        serviceCount: Object.keys(publishedDefinition.services || {}).length,
        variableCount: Array.isArray(meta.variables) ? meta.variables.length : 0,
    });

    return app;
}

function loadApps(options = {}) {
    const templatesDir = options.templatesDir || TEMPLATES_DIR;
    const names = listTemplateDirs(templatesDir);
    logger.info("apps", "discovered template directories", {
        count: names.length,
        names,
        templatesDir,
    });
    const apps = names.map((name) => loadTemplateApp(name, options));
    logger.info("apps", "loaded apps", { names: apps.map((app) => app.name) });
    return apps;
}

function toCatalog(apps) {
    return {
        oneClickApps: apps.map((app) => ({
            name: app.name,
            displayName: app.displayName,
            description: app.description,
            isOfficial: app.isOfficial,
            logoUrl: app.logoUrl,
        })),
    };
}

module.exports = {
    TEMPLATES_DIR,
    TEMPLATE_FILES,
    LOGO_FILES,
    existingFiles,
    listTemplateDirs,
    loadApps,
    loadTemplateApp,
    parseDefinition,
    publicUrl,
    publishedBaseUrl,
    rewriteStoreUrls,
    storeBaseUrl,
    storePathPrefix,
    toCatalog,
    validateApp,
};
