// Headless stub of `electron-log/main` for vitest.
// Aliased in vitest.config.ts.
const noop = () => {};

const log = {
    log: noop,
    info: noop,
    warn: noop,
    error: noop,
    verbose: noop,
    debug: noop,
    transports: {
        file: { level: 'verbose' },
        console: { level: 'verbose' },
    },
};

export default log;
