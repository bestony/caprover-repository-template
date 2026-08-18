const { templatesChangedFromGit } = require("../lib/precommit");
const logger = require("../lib/logger");

try {
    const changed = templatesChangedFromGit();
    logger.info("precommit", "skip-code-check probe", { templatesChanged: changed });
    process.exit(changed ? 0 : 1);
} catch (error) {
    logger.error("precommit", "could not inspect staged files", { error: error.message });
    process.exit(1);
}
