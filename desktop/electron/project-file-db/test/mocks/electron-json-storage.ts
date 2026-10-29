// Headless stub of `electron-json-storage` for vitest.
// Aliased in vitest.config.ts.
type Callback<T> = (err: Error | null, value: T) => void;

export default {
    setDataPath() {},
    getDataPath: () => '',
    has(_key: string, cb: Callback<boolean>) { cb(null, false); },
    get(_key: string, cb: Callback<object>) { cb(null, {}); },
    set(_key: string, _value: unknown, cb: Callback<null>) { cb(null, null); },
    remove(_key: string, cb: Callback<null>) { cb(null, null); },
    keys(cb: Callback<string[]>) { cb(null, []); },
    getSync: () => null,
};
