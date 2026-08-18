const assert = require("assert");
const storeConfig = require("../config");
const siteData = require("../src/_data/site");
const { pathPrefixFromBaseUrl, storeBaseUrl, storePathPrefix } = require("../lib/apps");
const logger = require("../lib/logger");

function withEnv(name, value, fn) {
    const previous = Object.prototype.hasOwnProperty.call(process.env, name)
        ? process.env[name]
        : undefined;
    if (value === undefined) {
        delete process.env[name];
    } else {
        process.env[name] = value;
    }
    try {
        return fn();
    } finally {
        if (previous === undefined) {
            delete process.env[name];
        } else {
            process.env[name] = previous;
        }
    }
}

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

const expectedUrl = storeConfig.url.replace(/\/+$/, "");
const expectedPrefix = pathPrefixFromBaseUrl(expectedUrl);

assert.strictEqual(storeBaseUrl(), expectedUrl);
assert.strictEqual(storePathPrefix(), expectedPrefix);

withEnv("SITE_URL", "https://custom.example.com/shop/", () => {
    assert.strictEqual(storeBaseUrl(), "https://custom.example.com/shop");
    assert.strictEqual(storePathPrefix(), "/shop");
});

withEnv("SITE_URL", "https://custom.example.com/shop", () => {
    withEnv("PATH_PREFIX", "/other/", () => {
        assert.strictEqual(storeBaseUrl(), "https://custom.example.com/shop");
        assert.strictEqual(storePathPrefix(), "/other");
    });
});

assert.strictEqual(storeBaseUrl("https://option.example.com/apps/"), "https://option.example.com/apps");
assert.strictEqual(storePathPrefix("/explicit/"), "/explicit");
assert.strictEqual(storeBaseUrl(""), "");
assert.strictEqual(storePathPrefix(""), "");

const site = siteData();
assert.strictEqual(site.title, storeConfig.title);
assert.strictEqual(site.description, storeConfig.description);
assert.strictEqual(site.keywords, storeConfig.keywords.join(", "));
assert.strictEqual(site.stylesheet, storeConfig.stylesheet);
assert.strictEqual(site.url, expectedUrl);
assert.strictEqual(site.ogType, storeConfig.ogType || "website");
assert.strictEqual(site.ogImage, storeConfig.ogImage || "");

logger.info("test", "site data is loaded from root config.js", {
    title: storeConfig.title,
    description: storeConfig.description,
    keywords: site.keywords,
    stylesheet: storeConfig.stylesheet,
    url: site.url,
    pathPrefix: expectedPrefix,
    ogType: site.ogType,
});
