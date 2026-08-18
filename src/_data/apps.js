const { loadApps } = require("../../lib/apps");
const logger = require("../../lib/logger");

module.exports = function appsData() {
    logger.debug("eleventy", "loading global apps data");
    return loadApps();
};
