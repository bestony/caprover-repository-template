const { spawnSync } = require("child_process");
const logger = require("./logger");

function isTemplatePath(filePath) {
    const normalized = String(filePath || "").replace(/\\/g, "/");
    return normalized === "templates" || normalized.startsWith("templates/");
}

function templatesChanged(files) {
    return files.some(isTemplatePath);
}

function listStagedFiles(runner = runGit) {
    const output = runner(["diff", "--cached", "--name-only", "--diff-filter=ACMRD"]);
    const files = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    logger.debug("precommit", "staged files", { files });
    return files;
}

function runGit(args) {
    const result = spawnSync("git", args, {
        encoding: "utf8",
        cwd: process.cwd(),
    });
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || "git command failed").trim();
        logger.error("precommit", "git command failed", { args, detail, status: result.status });
        throw new Error(detail);
    }
    return result.stdout || "";
}

function templatesChangedFromGit() {
    const changed = templatesChanged(listStagedFiles());
    logger.info("precommit", "template change detection", { changed });
    return changed;
}

module.exports = {
    isTemplatePath,
    listStagedFiles,
    templatesChanged,
    templatesChangedFromGit,
};
