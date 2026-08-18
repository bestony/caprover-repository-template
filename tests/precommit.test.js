const assert = require("assert");
const { isTemplatePath, templatesChanged } = require("../lib/precommit");
const logger = require("../lib/logger");

assert.strictEqual(isTemplatePath("templates/mysql/template.yaml"), true);
assert.strictEqual(isTemplatePath("templates"), true);
assert.strictEqual(isTemplatePath("lib/apps.js"), false);
assert.strictEqual(isTemplatePath("src/templates/index.njk"), false);

assert.strictEqual(templatesChanged(["lib/apps.js", "README.md"]), false);
assert.strictEqual(templatesChanged(["templates/mysql/logo.png"]), true);
assert.strictEqual(templatesChanged(["lib/apps.js", "templates/mysql/template.yaml"]), true);
assert.strictEqual(templatesChanged([]), false);

logger.info("test", "precommit template detection tests passed");
