const LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

function resolveLevel() {
    const raw = String(process.env.LOG_LEVEL || "info").toLowerCase();
    return Object.prototype.hasOwnProperty.call(LEVELS, raw) ? raw : "info";
}

function write(level, scope, message, extra) {
    if (LEVELS[level] > LEVELS[resolveLevel()]) {
        return;
    }

    const line = {
        time: new Date().toISOString(),
        level,
        scope,
        message,
    };

    if (extra !== undefined) {
        line.extra = extra;
    }

    const serialized = JSON.stringify(line);
    if (level === "error") {
        console.error(serialized);
        return;
    }
    if (level === "warn") {
        console.warn(serialized);
        return;
    }
    console.log(serialized);
}

module.exports = {
    error(scope, message, extra) {
        write("error", scope, message, extra);
    },
    warn(scope, message, extra) {
        write("warn", scope, message, extra);
    },
    info(scope, message, extra) {
        write("info", scope, message, extra);
    },
    debug(scope, message, extra) {
        write("debug", scope, message, extra);
    },
};
