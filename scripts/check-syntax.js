const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const logger = require("../lib/logger");

const PROJECT_ROOT = path.join(__dirname, "..");
const ROOT_FILES = ["config.js", "eleventy.config.js"];
const SOURCE_DIRS = ["lib", "scripts", "src", "tests"];

function collectJsFiles(dir, acc) {
    if (!fs.existsSync(dir)) {
        return;
    }

    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectJsFiles(fullPath, acc);
            return;
        }
        if (entry.name.endsWith(".js")) {
            acc.push(fullPath);
        }
    });
}

function listProjectJsFiles(root = PROJECT_ROOT) {
    const files = ROOT_FILES.map((fileName) => path.join(root, fileName)).filter((filePath) =>
        fs.existsSync(filePath)
    );
    SOURCE_DIRS.forEach((dirName) => collectJsFiles(path.join(root, dirName), files));
    return files.sort();
}

function checkSyntax(files = listProjectJsFiles()) {
    logger.info("syntax", "checking javascript syntax", { count: files.length, files });
    const failures = [];

    files.forEach((filePath) => {
        const result = spawnSync(process.execPath, ["--check", filePath], {
            encoding: "utf8",
        });
        if (result.status !== 0) {
            const detail = (result.stderr || result.stdout || "syntax check failed").trim();
            logger.error("syntax", "syntax error", { filePath, detail });
            failures.push({ filePath, detail });
        }
    });

    if (failures.length > 0) {
        throw new Error(`Syntax check failed for ${failures.length} file(s)`);
    }

    logger.info("syntax", "javascript syntax ok", { count: files.length });
    return files;
}

if (require.main === module) {
    try {
        checkSyntax();
    } catch (error) {
        logger.error("syntax", "syntax check failed", { error: error.message });
        process.exit(1);
    }
}

module.exports = {
    checkSyntax,
    listProjectJsFiles,
};
