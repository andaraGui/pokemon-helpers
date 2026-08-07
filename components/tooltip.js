// ---------------------------------------------------------------------------
// Tooltip global do design system v2: caixa fixa exibida abaixo de qualquer
// elemento com data-tip, por delegação de eventos. Respeita a preferência
// tooltipsEnabled (Configurações) e reage a mudanças dela em tempo real.
// Injeta o próprio <style> pra funcionar tanto nos iframes quanto no shell.
// ---------------------------------------------------------------------------
var PokemonHelperTooltip = globalThis.PokemonHelperTooltip || (() => {
    let enabled = true;

    PokemonHelperStorage.getUiPreferences()
        .then((preferences) => { enabled = preferences.tooltipsEnabled; })
        .catch(() => {});
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
            enabled = changes[PokemonHelperStorage.KEYS.uiPreferences].newValue?.tooltipsEnabled !== false;
        });
    }

    function ensureBox(doc) {
        let box = doc.getElementById('px-tooltip');
        if (box) return box;
        const style = doc.createElement('style');
        style.textContent = `
            #px-tooltip {
                position: fixed; z-index: 2147483647; max-width: 260px;
                padding: 6px 9px; background: #08080d; border: 1px solid #3a3a4c;
                box-shadow: 2px 2px 0 rgba(0,0,0,.5);
                font-family: 'Pixelify Sans', monospace; font-size: 15px; line-height: 1.35;
                color: #e6e6f0; pointer-events: none; display: none; white-space: pre-line;
            }`;
        doc.head.appendChild(style);
        box = doc.createElement('div');
        box.id = 'px-tooltip';
        // appendado no <html>, não no <body>: no content script do jogo o
        // overlay do painel (#pokemon-type-matchup-overlay) também é filho de
        // documentElement com o mesmo z-index — em empate, quem vem depois na
        // ordem do DOM pinta por cima, e o body normalmente vem antes.
        doc.documentElement.appendChild(box);
        return box;
    }

    function attach(doc) {
        if (doc.__pxTooltipAttached) return;
        doc.__pxTooltipAttached = true;
        const win = doc.defaultView;
        doc.addEventListener('mouseover', (event) => {
            const target = event.target.closest && event.target.closest('[data-tip]');
            if (!target || !enabled) return;
            const text = target.getAttribute('data-tip');
            if (!text) return;
            const box = ensureBox(doc);
            const rect = target.getBoundingClientRect();
            box.textContent = text;
            box.style.left = `${Math.max(4, Math.min(rect.left, win.innerWidth - 280))}px`;
            box.style.top = `${rect.bottom + 5}px`;
            box.style.display = 'block';
        });
        doc.addEventListener('mouseout', (event) => {
            if (event.target.closest && event.target.closest('[data-tip]')) {
                const box = doc.getElementById('px-tooltip');
                if (box) box.style.display = 'none';
            }
        });
    }

    return Object.freeze({ attach });
})();
globalThis.PokemonHelperTooltip = PokemonHelperTooltip;
