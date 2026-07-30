(function () {
    const ID = 'pokemon-type-matchup-overlay';
    const existing = document.getElementById(ID);
    if (existing) {
        existing.remove();
        return;
    }

    const container = document.createElement('div');
    container.id = ID;
    container.style.cssText = [
        'position: fixed',
        'top: 16px',
        'right: 16px',
        'width: 300px',
        'height: 300px',
        'z-index: 2147483647',
        'border-radius: 12px',
        'overflow: hidden',
        'box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5)'
    ].join(';');

    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('index.html');
    iframe.style.cssText = 'width: 100%; height: 100%; border: 0; display: block;';

    container.appendChild(iframe);
    document.documentElement.appendChild(container);
})();
