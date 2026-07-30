function injectOverlay(tabId) {
    if (!tabId) return;
    chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
    });
    // MAIN world: só ali dá pra sobrescrever o window.fetch que o jogo usa.
    chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['interceptor.js']
    });
}

chrome.action.onClicked.addListener((tab) => injectOverlay(tab.id));

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'toggle-overlay') injectOverlay(tab.id);
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'pkmn-helper-open-shortcuts') {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
});
