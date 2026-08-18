const { toCatalog } = require("../../lib/apps");
const logger = require("../../lib/logger");

module.exports = class CapRoverAppList {
    data() {
        return {
            permalink: "v4/list",
            eleventyAllowMissingExtension: true,
        };
    }

    render({ apps }) {
        const catalog = toCatalog(apps);
        logger.info("eleventy", "rendering v4/list", {
            count: catalog.oneClickApps.length,
            names: catalog.oneClickApps.map((app) => app.name),
        });
        return JSON.stringify(catalog);
    }
};
