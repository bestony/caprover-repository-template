const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const {
    LOGO_FILES,
    TEMPLATE_FILES,
    TEMPLATES_DIR,
    existingFiles,
    listTemplateDirs,
    parseDefinition,
    toCatalog,
} = require("./apps");
const logger = require("./logger");

const APP_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const BUILTIN_CAP_VARS = new Set(["$$cap_appname", "$$cap_root_domain"]);
const STORE_TOKENS = new Set([
    "$$store_base_url",
    "$$store_logo_url",
    "$$store_app_url",
]);
const CAP_TOKEN_PATTERN = /\$\$cap_[A-Za-z0-9_]+(?:\([^)]*\))?/g;
const STORE_TOKEN_PATTERN = /\$\$store_[A-Za-z0-9_]+/g;
const RECOGNIZED_SERVICE_KEYS = new Set([
    "image",
    "environment",
    "ports",
    "volumes",
    "depends_on",
    "hostname",
    "command",
    "cap_add",
    "caproverExtra",
    "restart",
]);

function issue(level, code, message, extra = {}) {
    return { level, code, message, ...extra };
}

function walkStrings(value, visit, trail = "") {
    if (typeof value === "string") {
        visit(value, trail);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => walkStrings(item, visit, `${trail}[${index}]`));
        return;
    }
    if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, child]) => {
            walkStrings(child, visit, trail ? `${trail}.${key}` : key);
        });
    }
}

function collectCapTokens(definition) {
    const tokens = new Set();
    walkStrings(definition, (text) => {
        const matches = text.match(CAP_TOKEN_PATTERN) || [];
        matches.forEach((token) => tokens.add(token));
    });
    Object.keys(definition.services || {}).forEach((serviceName) => {
        const matches = serviceName.match(CAP_TOKEN_PATTERN) || [];
        matches.forEach((token) => tokens.add(token));
    });
    return tokens;
}

function detectImageKind(buffer) {
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
    ) {
        return "png";
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "jpeg";
    }
    if (
        buffer.length >= 12 &&
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "webp";
    }
    return null;
}

function expectedImageKind(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".png") {
        return "png";
    }
    if (ext === ".jpg" || ext === ".jpeg") {
        return "jpeg";
    }
    if (ext === ".webp") {
        return "webp";
    }
    return null;
}

function checkAppName(name) {
    const issues = [];
    if (!APP_NAME_PATTERN.test(name)) {
        issues.push(
            issue(
                "error",
                "invalid_app_name",
                `Directory name "${name}" must be lowercase letters, numbers, and hyphens`,
                { name }
            )
        );
    }
    return issues;
}

function checkLayout(name, appDir) {
    const issues = [];
    const templateFiles = existingFiles(appDir, TEMPLATE_FILES);
    const logoFiles = existingFiles(appDir, LOGO_FILES);

    logger.debug("check", "layout", { name, appDir, templateFiles, logoFiles });

    if (templateFiles.length === 0) {
        issues.push(
            issue(
                "error",
                "missing_template",
                `Missing template.yaml, template.yml, or template.toml in templates/${name}/`,
                { name }
            )
        );
    }
    if (templateFiles.length > 1) {
        issues.push(
            issue(
                "error",
                "multiple_templates",
                `Multiple template files in templates/${name}/: ${templateFiles
                    .map((filePath) => path.basename(filePath))
                    .join(", ")}`,
                { name }
            )
        );
    }
    if (logoFiles.length === 0) {
        issues.push(
            issue(
                "error",
                "missing_logo",
                `Missing logo.png, logo.jpg, or logo.webp in templates/${name}/`,
                { name }
            )
        );
    }
    if (logoFiles.length > 1) {
        issues.push(
            issue(
                "error",
                "multiple_logos",
                `Multiple logo files in templates/${name}/: ${logoFiles
                    .map((filePath) => path.basename(filePath))
                    .join(", ")}`,
                { name }
            )
        );
    }

    return { issues, templatePath: templateFiles[0] || null, logoPath: logoFiles[0] || null };
}

function checkDefinition(name, definition) {
    const issues = [];

    if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
        issues.push(
            issue("error", "invalid_definition", `Template for ${name} must parse to an object`, {
                name,
            })
        );
        return issues;
    }

    if (String(definition.captainVersion) !== "4") {
        issues.push(
            issue(
                "error",
                "invalid_captain_version",
                `captainVersion must be 4 for ${name}, got ${definition.captainVersion}`,
                { name, path: "captainVersion" }
            )
        );
    }

    const meta = definition.caproverOneClickApp;
    if (!meta || typeof meta !== "object") {
        issues.push(
            issue("error", "missing_metadata", `Cannot find caproverOneClickApp for ${name}`, {
                name,
                path: "caproverOneClickApp",
            })
        );
        return issues;
    }

    if (!meta.description || typeof meta.description !== "string") {
        issues.push(
            issue("error", "missing_description", `Cannot find description for ${name}`, {
                name,
                path: "caproverOneClickApp.description",
            })
        );
    } else if (meta.description.length > 200) {
        issues.push(
            issue(
                "error",
                "description_too_long",
                `Description too long for ${name} - keep it below 200 chars`,
                { name, path: "caproverOneClickApp.description" }
            )
        );
    }

    if (!meta.instructions || typeof meta.instructions !== "object") {
        issues.push(
            issue("error", "missing_instructions", `Cannot find instructions for ${name}`, {
                name,
                path: "caproverOneClickApp.instructions",
            })
        );
    } else {
        if (!meta.instructions.start) {
            issues.push(
                issue(
                    "error",
                    "missing_instructions_start",
                    `Cannot find instructions.start for ${name}`,
                    { name, path: "caproverOneClickApp.instructions.start" }
                )
            );
        }
        if (!meta.instructions.end) {
            issues.push(
                issue(
                    "error",
                    "missing_instructions_end",
                    `Cannot find instructions.end for ${name}`,
                    { name, path: "caproverOneClickApp.instructions.end" }
                )
            );
        }
    }

    if (!meta.displayName) {
        issues.push(
            issue(
                "warning",
                "missing_display_name",
                `displayName is missing for ${name}; the catalog will fall back to the directory name`,
                { name, path: "caproverOneClickApp.displayName" }
            )
        );
    }

    if (meta.isOfficial !== undefined && typeof meta.isOfficial !== "boolean") {
        issues.push(
            issue(
                "warning",
                "is_official_type",
                `isOfficial for ${name} should be a boolean`,
                { name, path: "caproverOneClickApp.isOfficial" }
            )
        );
    }

    if (!meta.documentation) {
        issues.push(
            issue(
                "warning",
                "missing_documentation",
                `documentation is missing for ${name}`,
                { name, path: "caproverOneClickApp.documentation" }
            )
        );
    }

    if (!definition.services || typeof definition.services !== "object" || Array.isArray(definition.services)) {
        issues.push(
            issue("error", "missing_services", `Cannot find services map for ${name}`, {
                name,
                path: "services",
            })
        );
        return issues;
    }

    const serviceNames = Object.keys(definition.services);
    if (serviceNames.length === 0) {
        issues.push(
            issue("error", "empty_services", `services must contain at least one service for ${name}`, {
                name,
                path: "services",
            })
        );
    }

    serviceNames.forEach((serviceName) => {
        const service = definition.services[serviceName];
        const servicePath = `services.${serviceName}`;
        if (!service || typeof service !== "object") {
            issues.push(
                issue("error", "invalid_service", `Service ${serviceName} in ${name} must be an object`, {
                    name,
                    path: servicePath,
                })
            );
            return;
        }

        if (!String(serviceName).includes("$$cap_appname")) {
            issues.push(
                issue(
                    "warning",
                    "service_name_not_dynamic",
                    `Service ${serviceName} in ${name} should include $$cap_appname so installs do not collide`,
                    { name, path: servicePath }
                )
            );
        }

        const hasImage = Boolean(service.image);
        const hasDockerfile = Boolean(service.caproverExtra && service.caproverExtra.dockerfileLines);
        if (!hasImage && !hasDockerfile) {
            issues.push(
                issue(
                    "error",
                    "missing_image",
                    `Service ${serviceName} in ${name} must define image or caproverExtra.dockerfileLines`,
                    { name, path: servicePath }
                )
            );
        }
        if (hasImage && hasDockerfile) {
            issues.push(
                issue(
                    "error",
                    "image_and_dockerfile",
                    `Service ${serviceName} in ${name} cannot define both image and dockerfileLines`,
                    { name, path: servicePath }
                )
            );
        }

        Object.keys(service).forEach((key) => {
            if (!RECOGNIZED_SERVICE_KEYS.has(key)) {
                issues.push(
                    issue(
                        "warning",
                        "ignored_service_field",
                        `Service field "${key}" on ${serviceName} in ${name} is ignored by CapRover`,
                        { name, path: `${servicePath}.${key}` }
                    )
                );
            }
        });
    });

    const declaredIds = new Set();
    if (meta.variables !== undefined && !Array.isArray(meta.variables)) {
        issues.push(
            issue("error", "invalid_variables", `variables for ${name} must be a list`, {
                name,
                path: "caproverOneClickApp.variables",
            })
        );
    }

    (meta.variables || []).forEach((variable, index) => {
        const variablePath = `caproverOneClickApp.variables[${index}]`;
        if (!variable || !variable.id || !variable.label) {
            issues.push(
                issue(
                    "error",
                    "invalid_variable",
                    `Variable at index ${index} in ${name} must have id and label`,
                    { name, path: variablePath }
                )
            );
            return;
        }
        if (!String(variable.id).startsWith("$$cap")) {
            issues.push(
                issue(
                    "error",
                    "variable_prefix",
                    `Variable id must start with $$cap in ${name}: ${variable.id}`,
                    { name, path: `${variablePath}.id` }
                )
            );
        }
        if (declaredIds.has(variable.id)) {
            issues.push(
                issue(
                    "error",
                    "duplicate_variable",
                    `Duplicate variable id ${variable.id} in ${name}`,
                    { name, path: `${variablePath}.id` }
                )
            );
        }
        declaredIds.add(variable.id);
        if (variable.validRegex && !/^\/.*\/[a-z]*$/.test(String(variable.validRegex))) {
            issues.push(
                issue(
                    "warning",
                    "invalid_regex_shape",
                    `validRegex for ${variable.id} in ${name} should look like /pattern/`,
                    { name, path: `${variablePath}.validRegex` }
                )
            );
        }
    });

    const usedTokens = collectCapTokens(definition);
    usedTokens.forEach((token) => {
        if (token.startsWith("$$cap_gen_random_hex")) {
            return;
        }
        if (BUILTIN_CAP_VARS.has(token) || declaredIds.has(token)) {
            return;
        }
        issues.push(
            issue(
                "error",
                "undeclared_variable",
                `Template ${name} uses ${token} but does not declare it in caproverOneClickApp.variables`,
                { name }
            )
        );
    });

    declaredIds.forEach((id) => {
        const used = [...usedTokens].some((token) => token === id || token.startsWith(`${id}(`));
        if (!used) {
            issues.push(
                issue(
                    "warning",
                    "unused_variable",
                    `Variable ${id} is declared in ${name} but never used`,
                    { name }
                )
            );
        }
    });

    walkStrings(definition, (text, trail) => {
        const storeTokens = text.match(STORE_TOKEN_PATTERN) || [];
        storeTokens.forEach((token) => {
            if (!STORE_TOKENS.has(token)) {
                issues.push(
                    issue(
                        "warning",
                        "unknown_store_token",
                        `Unknown store placeholder ${token} at ${trail || "root"} in ${name}`,
                        { name, path: trail }
                    )
                );
            }
        });
    });

    return issues;
}

async function checkLogo(name, logoPath) {
    const issues = [];
    if (!logoPath) {
        return issues;
    }

    const buffer = fs.readFileSync(logoPath);
    logger.debug("check", "logo bytes", { name, logoPath, bytes: buffer.length });
    if (buffer.length === 0) {
        issues.push(issue("error", "empty_logo", `Logo for ${name} is empty`, { name, logoPath }));
        return issues;
    }

    const kind = detectImageKind(buffer);
    const expected = expectedImageKind(logoPath);
    if (!kind) {
        issues.push(
            issue("error", "invalid_logo", `Logo for ${name} is not a PNG, JPEG, or WEBP file`, {
                name,
                logoPath,
            })
        );
        return issues;
    }
    if (expected && kind !== expected) {
        issues.push(
            issue(
                "error",
                "logo_extension_mismatch",
                `Logo for ${name} is ${kind} but the file extension is ${path.extname(logoPath)}`,
                { name, logoPath }
            )
        );
    }

    try {
        const metadata = await sharp(logoPath).metadata();
        logger.debug("check", "logo metadata", {
            name,
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
        });
        if (!metadata.width || !metadata.height) {
            issues.push(
                issue("error", "undecodable_logo", `Logo for ${name} could not be decoded`, {
                    name,
                    logoPath,
                })
            );
        }
    } catch (error) {
        issues.push(
            issue("error", "undecodable_logo", `Logo for ${name} could not be decoded: ${error.message}`, {
                name,
                logoPath,
            })
        );
    }

    return issues;
}

async function checkOneTemplate(name, options = {}) {
    const templatesDir = options.templatesDir || TEMPLATES_DIR;
    const appDir = path.join(templatesDir, name);
    const issues = [...checkAppName(name)];
    const layout = checkLayout(name, appDir);
    issues.push(...layout.issues);

    let definition = null;
    if (layout.templatePath) {
        try {
            const raw = fs.readFileSync(layout.templatePath, "utf8");
            definition = parseDefinition(raw, layout.templatePath);
            issues.push(...checkDefinition(name, definition));
        } catch (error) {
            logger.error("check", "parse failed", { name, error: error.message });
            issues.push(
                issue("error", "parse_error", `Failed to parse template for ${name}: ${error.message}`, {
                    name,
                    templatePath: layout.templatePath,
                })
            );
        }
    }

    issues.push(...(await checkLogo(name, layout.logoPath)));

    const errorCount = issues.filter((item) => item.level === "error").length;
    return {
        name,
        templatePath: layout.templatePath,
        logoPath: layout.logoPath,
        definition,
        issues,
        ok: errorCount === 0 && Boolean(definition),
    };
}

function checkMerge(results) {
    const issues = [];
    const okResults = results.filter((result) => result.ok);
    const names = new Set();
    const displayNames = new Map();

    okResults.forEach((result) => {
        if (names.has(result.name)) {
            issues.push(
                issue("error", "duplicate_app_name", `Duplicate app name ${result.name}`, {
                    name: result.name,
                })
            );
        }
        names.add(result.name);

        const displayName = result.definition.caproverOneClickApp.displayName || result.name;
        if (!displayNames.has(displayName)) {
            displayNames.set(displayName, []);
        }
        displayNames.get(displayName).push(result.name);

        try {
            JSON.stringify(result.definition);
        } catch (error) {
            issues.push(
                issue(
                    "error",
                    "unserializable_definition",
                    `Definition for ${result.name} cannot be merged to JSON: ${error.message}`,
                    { name: result.name }
                )
            );
        }
    });

    displayNames.forEach((appNames, displayName) => {
        if (appNames.length > 1) {
            issues.push(
                issue(
                    "warning",
                    "duplicate_display_name",
                    `displayName "${displayName}" is used by ${appNames.join(", ")}`,
                    { name: appNames[0] }
                )
            );
        }
    });

    const catalogApps = okResults.map((result) => ({
        name: result.name,
        displayName: result.definition.caproverOneClickApp.displayName || result.name,
        description: result.definition.caproverOneClickApp.description || "",
        isOfficial:
            String(result.definition.caproverOneClickApp.isOfficial).toLowerCase().trim() === "true",
        logoUrl: `${result.name}.png`,
    }));

    try {
        const catalog = toCatalog(catalogApps);
        JSON.parse(JSON.stringify(catalog));
        logger.debug("check", "catalog merge ok", {
            count: catalog.oneClickApps.length,
            names: catalog.oneClickApps.map((app) => app.name),
        });
    } catch (error) {
        issues.push(
            issue("error", "catalog_merge_failed", `Catalog merge failed: ${error.message}`)
        );
    }

    return issues;
}

async function dryRunLogoMerge(results, outputDir) {
    const issues = [];
    const okResults = results.filter((result) => result.ok && result.logoPath);
    fs.mkdirSync(path.join(outputDir, "v4", "logos"), { recursive: true });

    for (const result of okResults) {
        const destination = path.join(outputDir, "v4", "logos", `${result.name}.png`);
        try {
            const ext = path.extname(result.logoPath).toLowerCase();
            if (ext === ".png") {
                fs.copyFileSync(result.logoPath, destination);
            } else {
                await sharp(result.logoPath).png().toFile(destination);
            }
            logger.debug("check", "logo merge output", { name: result.name, destination });
        } catch (error) {
            issues.push(
                issue(
                    "error",
                    "logo_merge_failed",
                    `Could not publish logo for ${result.name}: ${error.message}`,
                    { name: result.name }
                )
            );
        }
    }

    return issues;
}

async function checkTemplates(options = {}) {
    const templatesDir = options.templatesDir || TEMPLATES_DIR;
    const only = options.only || [];
    logger.info("check", "starting template check", { templatesDir, only });

    const names = listTemplateDirs(templatesDir).filter(
        (name) => only.length === 0 || only.includes(name)
    );
    const results = [];
    for (const name of names) {
        results.push(await checkOneTemplate(name, { templatesDir }));
    }

    const mergeIssues = checkMerge(results);
    let logoMergeIssues = [];
    const tempDir = options.mergeDir || fs.mkdtempSync(path.join(os.tmpdir(), "caprover-store-merge-"));
    try {
        logoMergeIssues = await dryRunLogoMerge(results, tempDir);
    } finally {
        if (!options.mergeDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    const issues = [
        ...results.flatMap((result) => result.issues),
        ...mergeIssues,
        ...logoMergeIssues,
    ];
    const errorCount = issues.filter((item) => item.level === "error").length;
    const warningCount = issues.filter((item) => item.level === "warning").length;

    const summary = {
        ok: errorCount === 0,
        templatesDir,
        checked: results.map((result) => result.name),
        errorCount,
        warningCount,
        results,
        mergeIssues,
        logoMergeIssues,
        issues,
    };
    logger.info("check", "template check finished", {
        ok: summary.ok,
        checked: summary.checked,
        errorCount,
        warningCount,
    });
    return summary;
}

function formatReport(summary) {
    const lines = [];
    lines.push(`Checking ${summary.templatesDir} (${summary.checked.length} app${summary.checked.length === 1 ? "" : "s"})`);
    lines.push("");

    summary.results.forEach((result) => {
        const mark = result.ok ? "ok" : "FAIL";
        lines.push(`[${mark}] ${result.name}`);
        if (result.templatePath) {
            lines.push(`      template: ${result.templatePath}`);
        }
        if (result.logoPath) {
            lines.push(`      logo: ${result.logoPath}`);
        }
        result.issues.forEach((item) => {
            lines.push(`      ${item.level.toUpperCase()} ${item.code}: ${item.message}`);
        });
        lines.push("");
    });

    lines.push("Merge");
    const mergeAll = [...summary.mergeIssues, ...summary.logoMergeIssues];
    if (mergeAll.length === 0) {
        lines.push("[ok] templates can be merged into one CapRover catalog");
    } else {
        mergeAll.forEach((item) => {
            lines.push(`[${item.level === "error" ? "FAIL" : "warn"}] ${item.code}: ${item.message}`);
        });
    }
    lines.push("");
    lines.push(
        `${summary.checked.length} checked, ${summary.errorCount} error(s), ${summary.warningCount} warning(s)`
    );
    return lines.join("\n");
}

module.exports = {
    APP_NAME_PATTERN,
    checkDefinition,
    checkOneTemplate,
    checkTemplates,
    formatReport,
};
