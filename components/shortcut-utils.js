// ---------------------------------------------------------------------------
// Normalização e exibição de combinações de atalho.
// Formato canônico: modificadores na ordem ctrl, alt, shift, meta + tecla
// minúscula (event.key), unidos por '+'. Ex.: "ctrl+shift+e", "t", "escape".
// Carregado no content world (background.js) e no painel de configurações.
// ---------------------------------------------------------------------------
var PokemonHelperShortcutUtils = globalThis.PokemonHelperShortcutUtils || (() => {
    const MODS = ['ctrl', 'alt', 'shift', 'meta'];
    // event.key dos próprios modificadores (minúsculo) — sozinhos não formam atalho
    const MOD_KEYS = ['control', 'alt', 'shift', 'meta', 'os', 'altgraph'];

    // aceita tanto um KeyboardEvent quanto o objeto serializado do postMessage
    function comboFromEvent(evt) {
        const key = String(evt.key || '').toLowerCase();
        if (!key || MOD_KEYS.includes(key)) return null;
        const parts = [];
        if (evt.ctrl || evt.ctrlKey) parts.push('ctrl');
        if (evt.alt || evt.altKey) parts.push('alt');
        if (evt.shift || evt.shiftKey) parts.push('shift');
        if (evt.meta || evt.metaKey) parts.push('meta');
        parts.push(key);
        return parts.join('+');
    }

    // split "na mão" em vez de String.split('+'): a própria tecla pode ser '+'
    function splitCombo(combo) {
        const mods = [];
        let rest = String(combo || '');
        for (const mod of MODS) {
            if (rest.startsWith(mod + '+') && rest.length > mod.length + 1) {
                mods.push(mod);
                rest = rest.slice(mod.length + 1);
            }
        }
        return { mods, key: rest };
    }

    const MOD_LABELS = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Meta' };
    const KEY_LABELS = {
        escape: 'ESC', ' ': 'ESPAÇO', arrowup: '↑', arrowdown: '↓',
        arrowleft: '←', arrowright: '→', enter: 'ENTER', tab: 'TAB'
    };

    function formatCombo(combo) {
        if (!combo) return '—';
        const { mods, key } = splitCombo(combo);
        return mods.map((mod) => MOD_LABELS[mod])
            .concat(KEY_LABELS[key] || key.toUpperCase())
            .join('+');
    }

    return Object.freeze({ comboFromEvent, splitCombo, formatCombo });
})();

globalThis.PokemonHelperShortcutUtils = PokemonHelperShortcutUtils;
