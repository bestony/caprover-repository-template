const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkTemplates } = require("../lib/check-templates");
const logger = require("../lib/logger");

function writeFile(filePath, contents) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
}

function validTemplate(overrides = "") {
    return [
        "captainVersion: 4",
        "services:",
        "  $$cap_appname-db:",
        "    image: mysql:$$cap_mysql_version",
        "    environment:",
        "      MYSQL_ROOT_PASSWORD: $$cap_db_pass",
        "    caproverExtra:",
        "      notExposeAsWebApp: 'true'",
        "caproverOneClickApp:",
        "  variables:",
        "    - id: $$cap_mysql_version",
        "      label: MySQL Version",
        "    - id: $$cap_db_pass",
        "      label: MySQL Root password",
        "  instructions:",
        "    start: Install",
        "    end: Done",
        "  displayName: MySQL",
        "  isOfficial: true",
        "  description: MySQL is a relational database management system based on SQL",
        "  documentation: https://example.com",
        overrides,
        "",
    ].join("\n");
}

async function main() {
    const realSummary = await checkTemplates();
    assert.strictEqual(realSummary.ok, true, formatErrors(realSummary));
    assert.ok(realSummary.checked.includes("mysql"));

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "caprover-check-"));
    try {
        const goodDir = path.join(tmpRoot, "mysql");
        writeFile(path.join(goodDir, "template.yaml"), validTemplate());
        fs.copyFileSync(
            path.join(__dirname, "..", "templates", "mysql", "logo.png"),
            path.join(goodDir, "logo.png")
        );

        const brokenDir = path.join(tmpRoot, "Broken_App");
        writeFile(
            path.join(brokenDir, "template.yaml"),
            [
                "captainVersion: 3",
                "services:",
                "  db:",
                "    restart: always",
                "caproverOneClickApp:",
                "  variables:",
                "    - id: db_pass",
                "      label: Password",
                "  instructions:",
                "    start: Install",
                "  description: " + "x".repeat(201),
                "",
            ].join("\n")
        );
        fs.writeFileSync(path.join(brokenDir, "logo.png"), "not-an-image");

        const missingVarDir = path.join(tmpRoot, "redis");
        writeFile(
            path.join(missingVarDir, "template.yaml"),
            [
                "captainVersion: 4",
                "services:",
                "  $$cap_appname:",
                "    image: redis:$$cap_redis_version",
                "caproverOneClickApp:",
                "  instructions:",
                "    start: Install",
                "    end: Done",
                "  displayName: Redis",
                "  description: Redis is an in-memory data store used as a cache",
                "",
            ].join("\n")
        );
        fs.copyFileSync(
            path.join(__dirname, "..", "templates", "mysql", "logo.png"),
            path.join(missingVarDir, "logo.png")
        );

        const summary = await checkTemplates({ templatesDir: tmpRoot });
        assert.strictEqual(summary.ok, false);
        const codes = summary.issues.map((item) => item.code);
        logger.debug("test", "collected issue codes", { codes });
        assert.ok(codes.includes("invalid_app_name"));
        assert.ok(codes.includes("invalid_captain_version"));
        assert.ok(codes.includes("missing_image"));
        assert.ok(codes.includes("missing_instructions_end"));
        assert.ok(codes.includes("description_too_long"));
        assert.ok(codes.includes("variable_prefix"));
        assert.ok(codes.includes("invalid_logo"));
        assert.ok(codes.includes("undeclared_variable"));
        assert.ok(codes.includes("missing_logo") === false);

        const goodOnly = await checkTemplates({ templatesDir: tmpRoot, only: ["mysql"] });
        assert.strictEqual(goodOnly.ok, true, formatErrors(goodOnly));
        assert.deepStrictEqual(goodOnly.checked, ["mysql"]);
    } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }

    logger.info("test", "template check tests passed");
}

function formatErrors(summary) {
    return summary.issues.map((item) => `${item.level}:${item.code}:${item.message}`).join("\n");
}

main().catch((error) => {
    logger.error("test", "template check tests failed", { error: error.message, stack: error.stack });
    process.exit(1);
});
