const assert = require("assert");
const storeConfig = require("../config");
const siteData = require("../src/_data/site");
const logger = require("../lib/logger");

assert.strictEqual(typeof storeConfig.title, "string");
assert.ok(storeConfig.title.trim(), "config.js title must be non-empty");
assert.strictEqual(typeof storeConfig.description, "string");
assert.ok(storeConfig.description.trim(), "config.js description must be non-empty");
assert.strictEqual(typeof storeConfig.stylesheet, "string");
assert.match(
    storeConfig.stylesheet,
    /bulma/i,
    "config.js stylesheet must point at Bulma"
);

const site = siteData();
assert.strictEqual(site.title, storeConfig.title);
assert.strictEqual(site.description, storeConfig.description);
assert.strictEqual(site.stylesheet, storeConfig.stylesheet);

logger.info("test", "site data is loaded from root config.js", {
    title: storeConfig.title,
    description: storeConfig.description,
    stylesheet: storeConfig.stylesheet,
});
