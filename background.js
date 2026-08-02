if (typeof PokemonHelperStorage === 'undefined') {
    importScripts('data/extension-storage.js');
}

const HOST_RE = /^https?:\/\/([^/]*\.)?infinitymmo\.net(\/|$)/;
const UPDATE_ALARM = 'pkmn-helper-check-updates';
const UPDATE_INTERVAL_MINUTES = 360;
let updateCheckPromise = null;

function compareVersions(left, right) {
    const leftParts = String(left).split('.').map(Number);
    const rightParts = String(right).split('.').map(Number);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
        const leftPart = leftParts[index] || 0;
        const rightPart = rightParts[index] || 0;
        if (leftPart > rightPart) return 1;
        if (leftPart < rightPart) return -1;
    }
    return 0;
}

function setUpdateAlarm(enabled) {
    chrome.alarms.clear(UPDATE_ALARM, () => {
        if (enabled) {
            chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: UPDATE_INTERVAL_MINUTES });
        }
    });
}

async function checkForUpdates() {
    if (updateCheckPromise) return updateCheckPromise;

    updateCheckPromise = (async () => {
        const preferences = await PokemonHelperStorage.getUpdatePreferences();
        if (!preferences.notificationsEnabled) {
            await PokemonHelperStorage.setUpdateStatus({ updateAvailable: false });
            return;
        }

        const branch = preferences.betaChannelEnabled ? 'develop' : 'main';
        const channel = preferences.betaChannelEnabled ? 'beta' : 'stable';
        const installedManifest = chrome.runtime.getManifest();
        const manifestName = installedManifest.browser_specific_settings
            ? 'manifest.firefox.json'
            : 'manifest.json';
        const manifestUrl = `https://raw.githubusercontent.com/andaraGui/pokemon-helpers/${branch}/${manifestName}`;

        try {
            const response = await fetch(manifestUrl, { cache: 'no-store' });
            if (!response.ok) throw new Error(`GitHub respondeu com status ${response.status}`);

            const remoteManifest = await response.json();
            if (!/^\d+(\.\d+)*$/.test(remoteManifest.version || '')) {
                throw new Error('Versão remota inválida');
            }

            await PokemonHelperStorage.setUpdateStatus({
                updateAvailable: compareVersions(remoteManifest.version, installedManifest.version) > 0,
                installedVersion: installedManifest.version,
                latestVersion: remoteManifest.version,
                channel,
                checkedAt: new Date().toISOString(),
                error: null
            });
        } catch (error) {
            const previousStatus = await PokemonHelperStorage.getUpdateStatus();
            const belongsToCurrentChannel = previousStatus.channel === channel;
            await PokemonHelperStorage.setUpdateStatus({
                ...previousStatus,
                updateAvailable: belongsToCurrentChannel && previousStatus.updateAvailable,
                installedVersion: installedManifest.version,
                channel,
                checkedAt: new Date().toISOString(),
                error: error.message
            });
            console.warn('[Pokemon Helper] Não foi possível verificar atualizações:', error);
        }
    })().finally(() => {
        updateCheckPromise = null;
    });

    return updateCheckPromise;
}

async function initializeUpdateChecks() {
    const preferences = await PokemonHelperStorage.getUpdatePreferences();
    setUpdateAlarm(preferences.notificationsEnabled);
    if (preferences.notificationsEnabled) await checkForUpdates();
}

// 'toggle': ícone/atalho — fecha o overlay se já estiver aberto.
// 'ensure': injeção automática (troca de página, F5) — nunca fecha, só garante
// que exista; precisa ser idempotente porque `tabs.onUpdated` pode disparar
// mais de um 'complete' pra mesma navegação.
function runContentScripts(tabId, mode) {
    if (!tabId) return;
    chrome.scripting
        .executeScript({
            target: { tabId },
            func: (m) => { window.__pkmnHelperInjectMode = m; },
            args: [mode],
        })
        .then(() => {
            chrome.scripting.executeScript({
                target: { tabId },
                files: ['data/extension-storage.js', 'components/header-buttons.js', 'content.js']
            });
            // MAIN world: só ali dá pra sobrescrever o window.fetch que o jogo usa.
            chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                files: ['interceptor.js']
            });
        })
        .catch(() => {});
}

chrome.action.onClicked.addListener((tab) => runContentScripts(tab.id, 'toggle'));

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'toggle-overlay') runContentScripts(tab.id, 'toggle');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && HOST_RE.test(tab.url)) {
        runContentScripts(tabId, 'ensure');
    }
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'pkmn-helper-open-shortcuts') {
        const isFirefox = typeof browser !== 'undefined';
        chrome.tabs.create({ url: isFirefox ? 'about:addons' : 'chrome://extensions/shortcuts' });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === UPDATE_ALARM) checkForUpdates();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[PokemonHelperStorage.KEYS.updatePreferences]) return;

    const preferences = Object.assign(
        {},
        PokemonHelperStorage.DEFAULT_UPDATE_PREFERENCES,
        changes[PokemonHelperStorage.KEYS.updatePreferences].newValue || {}
    );
    setUpdateAlarm(preferences.notificationsEnabled);
    checkForUpdates();
});

initializeUpdateChecks().catch((error) => {
    console.warn('[Pokemon Helper] Falha ao iniciar verificação de atualizações:', error);
});
