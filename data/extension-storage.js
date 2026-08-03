// Camada compartilhada de persistência da extensão.
// Mantém as chaves e valores padrão fora das telas e do service worker.
var PokemonHelperStorage = globalThis.PokemonHelperStorage || (() => {
    const KEYS = Object.freeze({
        overlaySettings: 'pkmnHelperSettings',
        updatePreferences: 'pkmnHelperUpdatePreferences',
        updateStatus: 'pkmnHelperUpdateStatus'
    });

    const DEFAULT_OVERLAY_SETTINGS = Object.freeze({
        top: 16,
        right: 16,
        width: 300,
        height: 360,
        collapsed: true,
        view: 'calc',
        open: true
    });

    const DEFAULT_UPDATE_PREFERENCES = Object.freeze({
        notificationsEnabled: false,
        betaChannelEnabled: false
    });

    const DEFAULT_UPDATE_STATUS = Object.freeze({
        updateAvailable: false,
        installedVersion: null,
        latestVersion: null,
        channel: null,
        checkedAt: null,
        error: null
    });

    function read(key, defaults) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (result) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(error);
                    return;
                }
                resolve(Object.assign({}, defaults, result[key] || {}));
            });
        });
    }

    function write(key, value) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                const error = chrome.runtime.lastError;
                if (error) {
                    reject(error);
                    return;
                }
                resolve(value);
            });
        });
    }

    async function update(key, defaults, changes) {
        const current = await read(key, defaults);
        return write(key, Object.assign(current, changes));
    }

    return Object.freeze({
        KEYS,
        DEFAULT_OVERLAY_SETTINGS,
        DEFAULT_UPDATE_PREFERENCES,
        DEFAULT_UPDATE_STATUS,
        getOverlaySettings: () => read(KEYS.overlaySettings, DEFAULT_OVERLAY_SETTINGS),
        setOverlaySettings: (settings) => write(KEYS.overlaySettings, settings),
        getUpdatePreferences: () => read(KEYS.updatePreferences, DEFAULT_UPDATE_PREFERENCES),
        setUpdatePreferences: (changes) => update(KEYS.updatePreferences, DEFAULT_UPDATE_PREFERENCES, changes),
        getUpdateStatus: () => read(KEYS.updateStatus, DEFAULT_UPDATE_STATUS),
        setUpdateStatus: (status) => write(KEYS.updateStatus, Object.assign({}, DEFAULT_UPDATE_STATUS, status))
    });
})();

globalThis.PokemonHelperStorage = PokemonHelperStorage;
