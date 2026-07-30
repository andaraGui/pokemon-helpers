(function () {
    const ID = 'pokemon-type-matchup-overlay';
    const existing = document.getElementById(ID);
    if (existing) {
        existing.remove();
        const style = document.getElementById('pokemon-helper-style');
        if (style) style.remove();
        return;
    }

    const STORAGE_KEY = 'pkmnHelperSettings';
    const DEFAULT_SETTINGS = { top: 16, right: 16, width: 300, height: 360, collapsed: true };
    const MIN_WIDTH = 220;
    const MIN_HEIGHT = 180;

    chrome.storage.local.get(STORAGE_KEY, (res) => {
        const settings = Object.assign({}, DEFAULT_SETTINGS, res[STORAGE_KEY] || {});
        build(settings);
    });

    function build(settings) {
        injectStyle();

        const container = document.createElement('div');
        container.id = ID;
        applyBox(container, settings);

        // ---- bolha flutuante: estado recolhido (menor espaço possível na tela) ----
        const bubble = document.createElement('button');
        bubble.className = 'ph-bubble';
        bubble.textContent = '🧭';
        bubble.title = 'Abrir Pokemon Helper';

        // ---- cabeçalho: ícones em linha (calc / encontro / config) + recolher ----
        const header = document.createElement('div');
        header.className = 'ph-header';

        const calcBtn = document.createElement('button');
        calcBtn.className = 'ph-icon-btn ph-view-btn';
        calcBtn.textContent = '🧮';
        calcBtn.title = 'Calculadora';
        calcBtn.dataset.view = 'calc';

        const battleBtn = document.createElement('button');
        battleBtn.className = 'ph-icon-btn ph-view-btn';
        battleBtn.textContent = '⚔️';
        battleBtn.title = 'Encontro';
        battleBtn.dataset.view = 'battle';

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'ph-icon-btn ph-view-btn';
        settingsBtn.textContent = '⚙️';
        settingsBtn.title = 'Configurações';
        settingsBtn.dataset.view = 'settings';

        const spacer = document.createElement('div');
        spacer.className = 'ph-spacer';

        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'ph-icon-btn';
        collapseBtn.textContent = '—';
        collapseBtn.title = 'Recolher';

        header.appendChild(calcBtn);
        header.appendChild(battleBtn);
        header.appendChild(settingsBtn);
        header.appendChild(spacer);
        header.appendChild(collapseBtn);

        // ---- corpo ----
        const body = document.createElement('div');
        body.className = 'ph-body';

        const calcFrame = document.createElement('iframe');
        calcFrame.id = 'pokemon-calc-frame';
        calcFrame.className = 'ph-frame';
        calcFrame.src = chrome.runtime.getURL('index.html');

        const battleFrame = document.createElement('iframe');
        battleFrame.id = 'pokemon-battle-frame';
        battleFrame.className = 'ph-frame';
        battleFrame.src = chrome.runtime.getURL('battle.html');

        const settingsPanel = buildSettingsPanel(settings, container);

        body.appendChild(calcFrame);
        body.appendChild(battleFrame);
        body.appendChild(settingsPanel);

        container.appendChild(bubble);
        container.appendChild(header);
        container.appendChild(body);
        document.documentElement.appendChild(container);

        setCollapsed(container, settings, settings.collapsed);
        setActiveView('calc', container);

        bubble.addEventListener('click', () => setCollapsed(container, settings, false));
        collapseBtn.addEventListener('click', () => setCollapsed(container, settings, true));

        header.addEventListener('click', (e) => {
            const btn = e.target.closest('.ph-view-btn');
            if (!btn) return;
            setActiveView(btn.dataset.view, container);
        });

        if (!window.__pkmnHelperBattleListenerAdded) {
            window.__pkmnHelperBattleListenerAdded = true;
            window.addEventListener('pkmn-helper-battle-data', (ev) => {
                const data = ev.detail;
                const frame = document.getElementById('pokemon-battle-frame');
                if (frame) frame.contentWindow.postMessage({ type: 'battle-data', payload: data }, '*');

                const overlay = document.getElementById(ID);
                if (!overlay) return;

                const battleEnded = !!(data.state && data.state.over === true);

                // battleEnded checado primeiro de propósito: a resposta de fim de
                // batalha (ex: fugir) também pode trazer um "foe.stats" completo
                // junto (não é exclusivo do início de encontro), então o fim tem
                // que ganhar prioridade sobre o foco quando os dois aparecem juntos.
                if (battleEnded) {
                    setActiveView('calc', overlay);
                } else if (data.foe && data.foe.stats) {
                    // um encontro relevante justifica ocupar espaço na tela mesmo
                    // se o usuário tinha recolhido a bolha antes
                    if (overlay.classList.contains('collapsed')) {
                        setCollapsed(overlay, currentSettings(overlay), false);
                    }
                    setActiveView('battle', overlay);
                }
            });
        }
    }

    function injectStyle() {
        if (document.getElementById('pokemon-helper-style')) return;
        const style = document.createElement('style');
        style.id = 'pokemon-helper-style';
        style.textContent = `
            #${ID} {
                position: fixed;
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                background: #14161c;
                color: #e8e9ee;
                font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
            }
            #${ID} .ph-bubble {
                display: none;
                width: 100%;
                height: 100%;
                border: 0;
                background: #1c1f28;
                color: #e8e9ee;
                font-size: 22px;
                cursor: pointer;
                align-items: center;
                justify-content: center;
            }
            #${ID}.collapsed {
                width: 48px !important;
                height: 48px !important;
                min-width: 0 !important;
                min-height: 0 !important;
                border-radius: 50%;
            }
            #${ID}.collapsed .ph-bubble { display: flex; }
            #${ID}.collapsed .ph-header,
            #${ID}.collapsed .ph-body { display: none !important; }
            #${ID} .ph-header {
                display: flex;
                align-items: center;
                flex: 0 0 auto;
                background: #1c1f28;
                gap: 2px;
                padding: 0 4px;
            }
            #${ID} .ph-icon-btn {
                flex: 0 0 auto;
                width: 30px;
                height: 34px;
                border: 0;
                border-radius: 6px;
                background: transparent;
                color: #9198ab;
                font-size: 14px;
                cursor: pointer;
            }
            #${ID} .ph-icon-btn:hover { color: #e8e9ee; }
            #${ID} .ph-view-btn.active {
                color: #ffb238;
                background: rgba(255, 178, 56, 0.14);
            }
            #${ID} .ph-spacer { flex: 1; }
            #${ID} .ph-body { flex: 1; position: relative; min-height: 0; }
            #${ID} .ph-frame {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                border: 0;
                display: none;
            }
            #${ID} .ph-settings {
                position: absolute;
                inset: 0;
                display: none;
                overflow-y: auto;
                padding: 12px;
                font-size: 12px;
                box-sizing: border-box;
            }
            #${ID} .ph-settings h3 {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #9198ab;
                margin: 0 0 8px;
            }
            #${ID} .ph-settings-row {
                display: flex;
                gap: 8px;
                margin-bottom: 10px;
            }
            #${ID} .ph-field { flex: 1; }
            #${ID} .ph-field label {
                display: block;
                color: #9198ab;
                font-size: 11px;
                margin-bottom: 3px;
            }
            #${ID} .ph-field input {
                width: 100%;
                box-sizing: border-box;
                background: #21242f;
                border: 1px solid #2e3240;
                color: #e8e9ee;
                border-radius: 6px;
                padding: 6px 8px;
                font-size: 12px;
            }
            #${ID} .ph-settings-actions {
                display: flex;
                gap: 8px;
                margin-top: 14px;
            }
            #${ID} .ph-settings-actions button {
                flex: 1;
                padding: 8px;
                border-radius: 8px;
                border: 0;
                cursor: pointer;
                font-size: 12px;
                font-weight: 700;
            }
            #${ID} .ph-btn-save { background: #ffb238; color: #1a1408; }
            #${ID} .ph-btn-shortcut { background: #21242f; color: #e8e9ee; border: 1px solid #2e3240 !important; width: 100%; margin-bottom: 4px; }
            #${ID} .ph-hint { color: #9198ab; font-size: 11px; margin: 4px 0 14px; }
        `;
        document.head.appendChild(style);
    }

    function buildSettingsPanel(settings, container) {
        const panel = document.createElement('div');
        panel.className = 'ph-settings';
        panel.id = 'pokemon-settings-panel';
        panel.innerHTML = `
            <h3>Posição na tela (px)</h3>
            <div class="ph-settings-row">
                <div class="ph-field">
                    <label for="ph-set-top">Topo</label>
                    <input type="number" id="ph-set-top" min="0" value="${settings.top}">
                </div>
                <div class="ph-field">
                    <label for="ph-set-right">Direita</label>
                    <input type="number" id="ph-set-right" min="0" value="${settings.right}">
                </div>
            </div>
            <h3>Tamanho (px)</h3>
            <div class="ph-settings-row">
                <div class="ph-field">
                    <label for="ph-set-width">Largura</label>
                    <input type="number" id="ph-set-width" min="${MIN_WIDTH}" value="${settings.width}">
                </div>
                <div class="ph-field">
                    <label for="ph-set-height">Altura</label>
                    <input type="number" id="ph-set-height" min="${MIN_HEIGHT}" value="${settings.height}">
                </div>
            </div>
            <h3>Atalho de teclado</h3>
            <button type="button" class="ph-btn-shortcut" id="ph-set-shortcut">Configurar atalho de abrir/fechar</button>
            <p class="ph-hint">Abre a página de atalhos do Chrome, onde dá pra definir a combinação de teclas que abre e fecha esta extensão em qualquer aba.</p>
            <div class="ph-settings-actions">
                <button type="button" class="ph-btn-save" id="ph-set-save">Salvar</button>
            </div>
        `;

        panel.querySelector('#ph-set-shortcut').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'pkmn-helper-open-shortcuts' });
        });

        panel.querySelector('#ph-set-save').addEventListener('click', () => {
            const top = clampNum(panel.querySelector('#ph-set-top').value, 0, 4000, settings.top);
            const right = clampNum(panel.querySelector('#ph-set-right').value, 0, 4000, settings.right);
            const width = clampNum(panel.querySelector('#ph-set-width').value, MIN_WIDTH, 4000, settings.width);
            const height = clampNum(panel.querySelector('#ph-set-height').value, MIN_HEIGHT, 4000, settings.height);

            Object.assign(settings, { top, right, width, height });
            applyBox(container, settings);
            persist(settings);
        });

        return panel;
    }

    function clampNum(value, min, max, fallback) {
        const n = parseInt(value, 10);
        if (Number.isNaN(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    function applyBox(container, settings) {
        if (container.classList.contains('collapsed')) return;
        container.style.top = `${settings.top}px`;
        container.style.right = `${settings.right}px`;
        container.style.width = `${settings.width}px`;
        container.style.height = `${settings.height}px`;
    }

    function setCollapsed(container, settings, collapsed) {
        settings.collapsed = collapsed;
        container.classList.toggle('collapsed', collapsed);
        if (!collapsed) applyBox(container, settings);
        persist(settings);
    }

    function currentSettings(container) {
        return {
            top: parseInt(container.style.top, 10) || DEFAULT_SETTINGS.top,
            right: parseInt(container.style.right, 10) || DEFAULT_SETTINGS.right,
            width: parseInt(container.style.width, 10) || DEFAULT_SETTINGS.width,
            height: parseInt(container.style.height, 10) || DEFAULT_SETTINGS.height,
            collapsed: container.classList.contains('collapsed'),
        };
    }

    function persist(settings) {
        chrome.storage.local.set({ [STORAGE_KEY]: settings });
    }

    // Busca os elementos por classe (em vez de usar closures) porque o layout
    // pode ser recriado do zero entre toggles da extensão.
    function setActiveView(view, container) {
        const calc = container.querySelector('#pokemon-calc-frame');
        const battle = container.querySelector('#pokemon-battle-frame');
        const settingsPanel = container.querySelector('#pokemon-settings-panel');
        if (!calc || !battle || !settingsPanel) return;

        calc.style.display = view === 'calc' ? 'block' : 'none';
        battle.style.display = view === 'battle' ? 'block' : 'none';
        settingsPanel.style.display = view === 'settings' ? 'block' : 'none';

        container.querySelectorAll('.ph-view-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }
})();
