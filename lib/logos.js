const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const logger = require("./logger");

function outputLogoPath(outputDir, app) {
    return path.join(outputDir, "v4", "logos", app.logoUrl);
}

async function publishLogo(app, outputDir) {
    const destination = outputLogoPath(outputDir, app);
    const sourceExt = path.extname(app.logoSourcePath).toLowerCase();
    fs.mkdirSync(path.dirname(destination), { recursive: true });

    logger.info("logos", "publishing logo", {
        name: app.name,
        source: app.logoSourcePath,
        destination,
        sourceExt,
    });

    if (sourceExt === ".png") {
        fs.copyFileSync(app.logoSourcePath, destination);
        logger.debug("logos", "copied png logo", {
            name: app.name,
            bytes: fs.statSync(destination).size,
        });
        return destination;
    }

    if (![".jpg", ".jpeg", ".webp"].includes(sourceExt)) {
        throw new Error(`Unsupported logo format for ${app.name}: ${sourceExt}`);
    }

    await sharp(app.logoSourcePath).png().toFile(destination);
    logger.info("logos", "converted logo to png", {
        name: app.name,
        sourceExt,
        bytes: fs.statSync(destination).size,
    });
    return destination;
}

async function publishLogos(apps, outputDir) {
    logger.info("logos", "publishing logos", {
        outputDir,
        count: apps.length,
        names: apps.map((app) => app.name),
    });
    const published = [];
    for (const app of apps) {
        published.push(await publishLogo(app, outputDir));
    }
    return published;
}

module.exports = {
    outputLogoPath,
    publishLogo,
    publishLogos,
};
