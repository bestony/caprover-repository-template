const { checkTemplates, formatReport } = require("../lib/check-templates");
const logger = require("../lib/logger");

async function main() {
    const args = process.argv.slice(2);
    const strict = args.includes("--strict");
    const only = args.filter((arg) => !arg.startsWith("-"));

    logger.info("check-cli", "running local template check", { only, strict });
    const summary = await checkTemplates({ only });
    const report = formatReport(summary);
    console.log(report);

    if (!summary.ok) {
        logger.error("check-cli", "template check failed", {
            errorCount: summary.errorCount,
            warningCount: summary.warningCount,
        });
        process.exit(1);
    }

    if (strict && summary.warningCount > 0) {
        logger.error("check-cli", "template check failed in strict mode", {
            warningCount: summary.warningCount,
        });
        process.exit(1);
    }

    logger.info("check-cli", "template check passed", {
        checked: summary.checked,
        warningCount: summary.warningCount,
    });
}

main().catch((error) => {
    logger.error("check-cli", "template check crashed", { error: error.message, stack: error.stack });
    process.exit(1);
});
