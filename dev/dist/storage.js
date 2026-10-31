const cap = typeof window !== "undefined" ? window.Capacitor : undefined;
const native = !!cap?.isNativePlatform?.();
const preferences = (method, options) => cap.nativePromise("Preferences", method, options);
export async function storageGet(key) {
    if (native) {
        try {
            const res = await preferences("get", { key });
            if (typeof res?.value === "string")
                return res.value;
        }
        catch (e) {
        }
    }
    try {
        return localStorage.getItem(key);
    }
    catch (e) {
        return null;
    }
}
export function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    }
    catch (e) {
    }
    if (native)
        preferences("set", { key, value }).catch(() => { });
}
export function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    }
    catch (e) {
    }
    if (native)
        preferences("remove", { key }).catch(() => { });
}
//# sourceMappingURL=storage.js.map