const logger = require("../../../lib/logger");

module.exports = class CapRoverAppDefinition {
    data() {
        return {
            pagination: {
                data: "apps",
                size: 1,
                alias: "app",
            },
            permalink(data) {
                return `v4/apps/${data.app.name}`;
            },
            eleventyAllowMissingExtension: true,
        };
    }

    render({ app }) {
        logger.info("eleventy", "rendering app definition", {
            name: app.name,
            output: `v4/apps/${app.name}`,
            captainVersion: app.definition.captainVersion,
        });
        return JSON.stringify(app.definition);
    }
};
