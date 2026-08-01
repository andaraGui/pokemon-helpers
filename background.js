const HOST_RE = /^https?:\/\/([^/]*\.)?infinitymmo\.net(\/|$)/;

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
                files: ['components/header-buttons.js', 'content.js']
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
