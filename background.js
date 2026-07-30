chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) return;
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    });
    // MAIN world: só ali dá pra sobrescrever o window.fetch que o jogo usa.
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        files: ['interceptor.js']
    });
});
