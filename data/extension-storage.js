// Camada compartilhada de persistência da extensão.
// Mantém as chaves e valores padrão fora das telas e do service worker.
var PokemonHelperStorage = globalThis.PokemonHelperStorage || (() => {
    const KEYS = Object.freeze({
        overlaySettings: 'pkmnHelperSettings',
        updatePreferences: 'pkmnHelperUpdatePreferences',
        updateStatus: 'pkmnHelperUpdateStatus',
        abilities: 'pkmnHelperAbilities',
        pokedex: 'pkmnHelperPokedex',
        trainerMoves: 'pkmnHelperTrainerMoves',
        discoveredMoves: 'pkmnHelperDiscoveredMoves',
        uiPreferences: 'pkmnHelperUiPreferences'
    });

    const DEFAULT_OVERLAY_SETTINGS = Object.freeze({
        top: 16,
        right: 16,
        width: 300,
        height: 360,
        maximized: false,
        restoreWidth: null,
        restoreRight: null,
        restoreTop: null,
        restoreHeight: null,
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

    const DEFAULT_UI_PREFERENCES = Object.freeze({
        tooltipsEnabled: true,
        startView: 'last',            // 'last' | 'battle' | 'calc' | 'myPokemons'
        startCollapsed: 'remember',   // 'remember' | 'collapsed' | 'open'
        autoSwitchToBattle: true,
        // ação → combinação normalizada (ver PokemonHelperShortcutUtils)
        shortcuts: Object.freeze({
            battle: '1',
            calc: '2',
            myPokemons: '3',
            settings: '4',
            typeChart: 't',
            toggleFull: 'f',
            minimize: '`'
        }),
        screens: Object.freeze({
            myPokemons: Object.freeze({
                expandPokemonByDefault: false,
                expandGroupsByDefault: true
            }),
            battle: Object.freeze({
                showStatChanges: true,
                showWeaknesses: true,
                showFoeMoves: true,
                showPokeballs: true,
                showIvs: true,
                showMyMoves: true
            })
        })
    });

    // Depois de recarregar/atualizar a extensão, o content script antigo
    // continua vivo na aba com o contexto morto: chrome.runtime.id some e
    // qualquer chamada ao chrome.storage lança "Extension context
    // invalidated". Degrada para os padrões e avisa uma única vez.
    let invalidContextNotified = false;

    function isContextValid() {
        return Boolean(globalThis.chrome?.runtime?.id);
    }

    function invalidContextFallback(value) {
        if (!invalidContextNotified) {
            invalidContextNotified = true;
            console.info('[Pokemon Helper] A extensão foi atualizada ou recarregada. Recarregue a página do jogo para reativar o overlay.');
        }
        return Promise.resolve(value);
    }

    function read(key, defaults) {
        if (!isContextValid()) return invalidContextFallback(Object.assign({}, defaults));
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(key, (result) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(Object.assign({}, defaults, result[key] || {}));
                });
            } catch (error) {
                // contexto invalidado entre a checagem e a chamada
                if (/context invalidated/i.test(error?.message)) {
                    resolve(invalidContextFallback(Object.assign({}, defaults)));
                    return;
                }
                reject(error);
            }
        });
    }

    function write(key, value) {
        if (!isContextValid()) return invalidContextFallback(value);
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ [key]: value }, () => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(value);
                });
            } catch (error) {
                if (/context invalidated/i.test(error?.message)) {
                    resolve(invalidContextFallback(value));
                    return;
                }
                reject(error);
            }
        });
    }

    async function update(key, defaults, changes) {
        const current = await read(key, defaults);
        return write(key, Object.assign(current, changes));
    }

    // uiPreferences tem objetos aninhados (shortcuts, screens) — o merge raso
    // de read() substituiria o objeto inteiro pelo salvo, e uma versão futura
    // que adicionasse uma ação/tela nova deixaria configs antigas sem o campo.
    function mergeUiPreferences(stored) {
        const prefs = Object.assign({}, DEFAULT_UI_PREFERENCES, stored);
        prefs.shortcuts = Object.assign({}, DEFAULT_UI_PREFERENCES.shortcuts, stored && stored.shortcuts);
        prefs.screens = {};
        Object.keys(DEFAULT_UI_PREFERENCES.screens).forEach((screen) => {
            prefs.screens[screen] = Object.assign({},
                DEFAULT_UI_PREFERENCES.screens[screen],
                stored && stored.screens && stored.screens[screen]);
        });
        return prefs;
    }

    function getUiPreferencesDeep() {
        return read(KEYS.uiPreferences, {}).then(mergeUiPreferences);
    }

    async function updateUiPreferences(changes) {
        const current = await getUiPreferencesDeep();
        const next = Object.assign({}, current, changes);
        if (changes.shortcuts) next.shortcuts = Object.assign({}, current.shortcuts, changes.shortcuts);
        if (changes.screens) {
            next.screens = {};
            Object.keys(current.screens).forEach((screen) => {
                next.screens[screen] = Object.assign({}, current.screens[screen], changes.screens[screen]);
            });
        }
        return write(KEYS.uiPreferences, next);
    }

    return Object.freeze({
        KEYS,
        DEFAULT_OVERLAY_SETTINGS,
        DEFAULT_UPDATE_PREFERENCES,
        DEFAULT_UPDATE_STATUS,
        DEFAULT_UI_PREFERENCES,
        getOverlaySettings: () => read(KEYS.overlaySettings, DEFAULT_OVERLAY_SETTINGS),
        setOverlaySettings: (settings) => write(KEYS.overlaySettings, settings),
        getUpdatePreferences: () => read(KEYS.updatePreferences, DEFAULT_UPDATE_PREFERENCES),
        setUpdatePreferences: (changes) => update(KEYS.updatePreferences, DEFAULT_UPDATE_PREFERENCES, changes),
        getUpdateStatus: () => read(KEYS.updateStatus, DEFAULT_UPDATE_STATUS),
        setUpdateStatus: (status) => write(KEYS.updateStatus, Object.assign({}, DEFAULT_UPDATE_STATUS, status)),
        getUiPreferences: getUiPreferencesDeep,
        setUiPreferences: updateUiPreferences,
        getAbilities: () => read(KEYS.abilities, { items: [], checkedAt: null, error: null }),
        setAbilities: (value) => write(KEYS.abilities, value),
        getPokedex: () => read(KEYS.pokedex, { items: [], checkedAt: null, error: null }),
        setPokedex: (value) => write(KEYS.pokedex, value),
        getTrainerMoves: () => read(KEYS.trainerMoves, { items: [], checkedAt: null, error: null }),
        setTrainerMoves: (value) => write(KEYS.trainerMoves, value),
        getDiscoveredMoves: () => read(KEYS.discoveredMoves, { items: [] }),
        setDiscoveredMoves: (value) => write(KEYS.discoveredMoves, value)
    });
})();

globalThis.PokemonHelperStorage = PokemonHelperStorage;
