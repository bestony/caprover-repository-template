const fs = require("fs");
const path = require("path");
const { loadApps, publishedBaseUrl, storePathPrefix } = require("./lib/apps");
const { publishLogos } = require("./lib/logos");
const logger = require("./lib/logger");

function eleventyPathPrefix() {
    const runMode = process.env.ELEVENTY_RUN_MODE;
    if (runMode === "serve" || runMode === "watch") {
        logger.debug("eleventy", "local preview uses root path prefix", { runMode });
        return "/";
    }
    const prefix = storePathPrefix();
    return prefix ? `${prefix}/` : "/";
}

module.exports = function (eleventyConfig) {
    eleventyConfig.configureErrorReporting({ allowMissingExtensions: true });
    eleventyConfig.addWatchTarget("templates/");
    eleventyConfig.addWatchTarget("config.js");

    eleventyConfig.on("eleventy.before", ({ directories }) => {
        logger.info("eleventy", "build starting", {
            input: directories.input,
            output: directories.output,
            siteUrl: publishedBaseUrl(),
            pathPrefix: eleventyPathPrefix(),
        });
    });

    eleventyConfig.on("eleventy.after", async ({ dir, results }) => {
        const apps = loadApps();
        await publishLogos(apps, dir.output);
        const nojekyllPath = path.join(dir.output, ".nojekyll");
        fs.writeFileSync(nojekyllPath, "");
        logger.info("eleventy", "build complete", {
            output: dir.output,
            files: results.map((result) => result.outputPath),
            logos: apps.map((app) => `v4/logos/${app.logoUrl}`),
            nojekyllPath,
        });
    });

    return {
        pathPrefix: eleventyPathPrefix(),
        dir: {
            input: "src",
            output: "dist",
            includes: "_includes",
            data: "_data",
        },
        htmlTemplateEngine: "njk",
        markdownTemplateEngine: "njk",
    };
};
