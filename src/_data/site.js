const { publishedBaseUrl } = require("../../lib/apps");
const logger = require("../../lib/logger");
const storeConfig = require("../../config");

module.exports = function siteData() {
    const title = storeConfig.title;
    const description = storeConfig.description;
    const stylesheet = storeConfig.stylesheet;
    const url = publishedBaseUrl();

    logger.debug("eleventy", "loading site config from root config.js", {
        title,
        description,
        stylesheet,
        url,
    });

    if (!title || !description || !stylesheet) {
        logger.error("eleventy", "root config.js is missing required fields", {
            title,
            description,
            stylesheet,
        });
        throw new Error("config.js must export non-empty title, description, and stylesheet");
    }

    return {
        title,
        description,
        stylesheet,
        url,
    };
};
