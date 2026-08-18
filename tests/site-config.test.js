const assert = require("assert");
const storeConfig = require("../config");
const siteData = require("../src/_data/site");
const logger = require("../lib/logger");

assert.strictEqual(typeof storeConfig.title, "string");
assert.ok(storeConfig.title.trim(), "config.js title must be non-empty");
assert.strictEqual(typeof storeConfig.description, "string");
assert.ok(storeConfig.description.trim(), "config.js description must be non-empty");
assert.ok(Array.isArray(storeConfig.keywords), "config.js keywords must be an array");
assert.ok(
    storeConfig.keywords.every((item) => typeof item === "string" && item.trim()),
    "config.js keywords must be non-empty strings"
);
assert.strictEqual(typeof storeConfig.url, "string");
assert.match(storeConfig.url, /^https?:\/\//, "config.js url must be an absolute http(s) URL");
assert.strictEqual(typeof storeConfig.stylesheet, "string");
assert.match(
    storeConfig.stylesheet,
    /bulma/i,
    "config.js stylesheet must point at Bulma"
);

const site = siteData();
assert.strictEqual(site.title, storeConfig.title);
assert.strictEqual(site.description, storeConfig.description);
assert.strictEqual(site.keywords, storeConfig.keywords.join(", "));
assert.strictEqual(site.stylesheet, storeConfig.stylesheet);
assert.ok(site.url, "site url must resolve from SITE_URL or config.js url");
assert.strictEqual(site.ogType, storeConfig.ogType || "website");
assert.strictEqual(site.ogImage, storeConfig.ogImage || "");

logger.info("test", "site data is loaded from root config.js", {
    title: storeConfig.title,
    description: storeConfig.description,
    keywords: site.keywords,
    stylesheet: storeConfig.stylesheet,
    ogType: site.ogType,
});
