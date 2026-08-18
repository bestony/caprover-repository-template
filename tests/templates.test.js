const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    loadApps,
    parseDefinition,
    rewriteStoreUrls,
    toCatalog,
} = require("../lib/apps");
const storeConfig = require("../config");
const logger = require("../lib/logger");

function writeFile(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function makeDefinition({ description = "A short description", extraDocs = "" } = {}) {
    return {
        captainVersion: 4,
        services: {
            "$$cap_appname-db": {
                image: "mysql:8.4.3",
                environment: {
                    MYSQL_ROOT_PASSWORD: "secret",
                },
                caproverExtra: {
                    notExposeAsWebApp: "true",
                },
            },
        },
        caproverOneClickApp: {
            variables: [
                {
                    id: "$$cap_mysql_version",
                    label: "MySQL Version",
                },
            ],
            instructions: {
                start: "Install MySQL",
                end: `Available at $$store_app_url. Logo: $$store_logo_url. Base: $$store_base_url${extraDocs}`,
            },
            displayName: "MySQL",
            isOfficial: true,
            description,
            documentation: "https://example.com",
        },
    };
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "caprover-store-"));

try {
    const yamlAppDir = path.join(tmpRoot, "mysql");
    writeFile(
        path.join(yamlAppDir, "template.yaml"),
        [
            "captainVersion: 4",
            "services:",
            "  $$cap_appname-db:",
            "    image: mysql:8.4.3",
            "    caproverExtra:",
            "      notExposeAsWebApp: 'true'",
            "caproverOneClickApp:",
            "  variables:",
            "    - id: $$cap_mysql_version",
            "      label: MySQL Version",
            "  instructions:",
            "    start: Install",
            "    end: See $$store_logo_url",
            "  displayName: MySQL",
            "  isOfficial: true",
            "  description: MySQL is a relational database management system based on SQL",
            "  documentation: Taken from $$store_base_url",
            "",
        ].join("\n")
    );
    fs.copyFileSync(
        path.join(__dirname, "..", "templates", "mysql", "logo.png"),
        path.join(yamlAppDir, "logo.png")
    );

    const yamlApps = loadApps({
        templatesDir: tmpRoot,
        baseUrl: "https://store.example.com",
    });
    assert.strictEqual(yamlApps.length, 1);
    assert.strictEqual(yamlApps[0].name, "mysql");
    assert.strictEqual(yamlApps[0].logoUrl, "mysql.png");
    assert.strictEqual(
        yamlApps[0].logoPath,
        "https://store.example.com/v4/logos/mysql.png"
    );
    assert.strictEqual(
        yamlApps[0].definition.caproverOneClickApp.instructions.end,
        "See https://store.example.com/v4/logos/mysql.png"
    );
    assert.strictEqual(
        yamlApps[0].definition.caproverOneClickApp.documentation,
        "Taken from https://store.example.com"
    );

    const catalog = toCatalog(yamlApps);
    assert.deepStrictEqual(catalog.oneClickApps[0].logoUrl, "mysql.png");

    const prefixedApps = loadApps({
        templatesDir: tmpRoot,
        baseUrl: "",
        pathPrefix: "/caprover-repository/",
    });
    assert.strictEqual(
        prefixedApps[0].logoPath,
        "/caprover-repository/v4/logos/mysql.png"
    );

    const configuredApps = loadApps({
        templatesDir: tmpRoot,
    });
    const configuredBaseUrl = storeConfig.url.replace(/\/+$/, "");
    assert.strictEqual(
        configuredApps[0].logoPath,
        `${configuredBaseUrl}/v4/logos/mysql.png`
    );
    assert.strictEqual(
        configuredApps[0].definition.caproverOneClickApp.documentation,
        `Taken from ${configuredBaseUrl}`
    );

    const tomlSource = [
        "captainVersion = 4",
        "",
        "[services.\"$$cap_appname-db\"]",
        "image = \"mysql:8.4.3\"",
        "",
        "[services.\"$$cap_appname-db\".caproverExtra]",
        "notExposeAsWebApp = \"true\"",
        "",
        "[caproverOneClickApp]",
        "displayName = \"MySQL\"",
        "isOfficial = true",
        "description = \"MySQL is a relational database management system based on SQL\"",
        "documentation = \"docs\"",
        "",
        "[[caproverOneClickApp.variables]]",
        "id = \"$$cap_mysql_version\"",
        "label = \"MySQL Version\"",
        "",
        "[caproverOneClickApp.instructions]",
        "start = \"Install\"",
        "end = \"Done\"",
        "",
    ].join("\n");
    const parsedToml = parseDefinition(tomlSource, "template.toml");
    assert.strictEqual(parsedToml.captainVersion, 4);
    assert.strictEqual(
        parsedToml.services["$$cap_appname-db"].image,
        "mysql:8.4.3"
    );

    const rewritten = rewriteStoreUrls(makeDefinition(), {
        "$$store_base_url": "https://store.example.com",
        "$$store_logo_url": "https://store.example.com/v4/logos/mysql.png",
        "$$store_app_url": "https://store.example.com/v4/apps/mysql",
    });
    assert.match(
        rewritten.caproverOneClickApp.instructions.end,
        /https:\/\/store\.example\.com\/v4\/apps\/mysql/
    );

    logger.info("test", "template discovery and url rewrite tests passed", {
        tmpRoot,
    });
} finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
}
