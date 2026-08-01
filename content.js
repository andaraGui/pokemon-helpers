(function () {
    const ID = 'pokemon-type-matchup-overlay';
    const STORAGE_KEY = 'pkmnHelperSettings';
    const DEFAULT_SETTINGS = { top: 16, right: 16, width: 300, height: 360, collapsed: true, view: 'calc', open: true };
    const MIN_WIDTH = 220;
    const MIN_HEIGHT = 180;

    // 'toggle' (ícone/atalho) fecha se já existir; 'ensure' (injeção automática
    // ao carregar a página) nunca fecha o que já está aberto — só garante que
    // exista, senão um F5 rápido pode disparar essa injeção mais de uma vez
    // e derrubar um overlay recém-minimizado.
    const mode = window.__pkmnHelperInjectMode || 'toggle';
    delete window.__pkmnHelperInjectMode;

    const existing = document.getElementById(ID);
    if (existing) {
        if (mode === 'ensure') return;
        existing.remove();
        const style = document.getElementById('pokemon-helper-style');
        if (style) style.remove();
        // fechado explicitamente: não deixa a injeção automática reabrir sozinha
        persist(Object.assign({}, currentSettings(existing), { open: false }));
        return;
    }

    // a leitura do storage é assíncrona, e o <div> só entra no DOM depois que
    // ela resolve — se 'ensure' disparar mais de uma vez pra mesma navegação
    // (tabs.onUpdated pode emitir 'complete' repetido), a checagem de
    // `existing` acima não vê nada ainda em nenhuma das duas e cada uma monta
    // seu próprio overlay duplicado. Essa flag síncrona reserva a construção
    // antes do await, então a segunda chamada desiste na hora.
    if (mode === 'ensure') {
        if (window.__pkmnHelperEnsurePending) return;
        window.__pkmnHelperEnsurePending = true;
    }

    chrome.storage.local.get(STORAGE_KEY, (res) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        const settings = Object.assign({}, DEFAULT_SETTINGS, res[STORAGE_KEY] || {});
        if (mode === 'ensure' && settings.open === false) return;
        settings.open = true;
        build(settings);
    });

    function build(settings) {
        injectStyle();

        const container = document.createElement('div');
        container.id = ID;
        applyBox(container, settings);

        // ---- bolha flutuante: estado recolhido (menor espaço possível na tela) ----
        const bubble = document.createElement('button');
        bubble.className = 'ph-bubble pxl-bubble';
        bubble.textContent = '🧭';
        bubble.title = 'Abrir Pokemon Helper';

        // ---- cabeçalho: ícones em linha (calc / encontro / meus pokémons / tabela / config) + recolher ----
        // buildHeaderButtons vem de components/header-buttons.js
        const header = document.createElement('div');
        header.className = 'ph-header';

        const collapseBtn = buildHeaderButtons(header, [
            { icon: '🧮', title: 'Calculadora', view: 'calc' },
            { icon: '⚔️', title: 'Encontro', view: 'battle' },
            { icon: '🖥️', title: 'Meus Pokémons', view: 'myPokemons' },
            { icon: '📊', title: 'Tabela de tipos', view: 'chart' },
            { icon: '⚙️', title: 'Configurações', view: 'settings' },
        ], { icon: '—', title: 'Recolher' });

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

        const myPokemonsFrame = document.createElement('iframe');
        myPokemonsFrame.id = 'pokemon-myPokemons-frame';
        myPokemonsFrame.className = 'ph-frame';
        myPokemonsFrame.src = chrome.runtime.getURL('myPokemons.html');

        const chartFrame = document.createElement('iframe');
        chartFrame.id = 'pokemon-chart-frame';
        chartFrame.className = 'ph-frame';
        chartFrame.src = chrome.runtime.getURL('chart.html');

        const settingsPanel = buildSettingsPanel();

        body.appendChild(calcFrame);
        body.appendChild(battleFrame);
        body.appendChild(myPokemonsFrame);
        body.appendChild(chartFrame);
        body.appendChild(settingsPanel);

        const RESIZE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        const resizeHandles = RESIZE_DIRS.map((dir) => {
            const handle = document.createElement('div');
            handle.className = `ph-resize-handle ph-resize-${dir}`;
            handle.dataset.dir = dir;
            return handle;
        });

        container.appendChild(bubble);
        container.appendChild(header);
        container.appendChild(body);
        resizeHandles.forEach((handle) => container.appendChild(handle));
        document.documentElement.appendChild(container);

        // ---- mover: arrastar pelo cabeçalho (fora dos botões) ----
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ph-icon-btn')) return;
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startTop = settings.top;
            const startRight = settings.right;
            const maxTop = Math.max(0, window.innerHeight - settings.height);
            const maxRight = Math.max(0, window.innerWidth - settings.width);

            let rafScheduled = false;
            const onMove = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;
                settings.top = clampNum(startTop + dy, 0, maxTop, startTop);
                settings.right = clampNum(startRight - dx, 0, maxRight, startRight);
                if (!rafScheduled) {
                    rafScheduled = true;
                    requestAnimationFrame(() => {
                        rafScheduled = false;
                        applyBox(container, settings);
                    });
                }
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                persist(currentSettings(container));
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // ---- redimensionar: arrastar qualquer borda/canto ----
        resizeHandles.forEach((handle) => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dir = handle.dataset.dir;
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = settings.width;
                const startHeight = settings.height;
                const startTop = settings.top;
                const startRight = settings.right;

                let rafScheduled = false;
                const onMove = (moveEvent) => {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;

                    if (dir.includes('e')) {
                        const newWidth = clampNum(startWidth + dx, MIN_WIDTH, 4000, startWidth);
                        settings.right = startRight - (newWidth - startWidth);
                        settings.width = newWidth;
                    } else if (dir.includes('w')) {
                        settings.width = clampNum(startWidth - dx, MIN_WIDTH, 4000, startWidth);
                    }

                    if (dir.includes('s')) {
                        settings.height = clampNum(startHeight + dy, MIN_HEIGHT, 4000, startHeight);
                    } else if (dir.includes('n')) {
                        const newHeight = clampNum(startHeight - dy, MIN_HEIGHT, 4000, startHeight);
                        settings.top = startTop + (startHeight - newHeight);
                        settings.height = newHeight;
                    }

                    if (!rafScheduled) {
                        rafScheduled = true;
                        requestAnimationFrame(() => {
                            rafScheduled = false;
                            applyBox(container, settings);
                        });
                    }
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    persist(currentSettings(container));
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });

        setCollapsed(container, settings, settings.collapsed);
        setActiveView(settings.view || 'calc', container);

        bubble.addEventListener('click', () => setCollapsed(container, settings, false));
        collapseBtn.addEventListener('click', () => setCollapsed(container, settings, true));

        header.addEventListener('click', (e) => {
            const btn = e.target.closest('.ph-view-btn');
            if (!btn) return;
            delete container.dataset.preBattleView; // navegação manual cancela o retorno automático
            setActiveView(btn.dataset.view, container);
        });

        if (!window.__pkmnHelperPayloadListenerAdded) {
            window.__pkmnHelperPayloadListenerAdded = true;

            const handleHelperPayload = (ev) => {
                const data = ev.detail;
                const battleFrame = document.getElementById('pokemon-battle-frame');
                const myPokemonsFrame = document.getElementById('pokemon-myPokemons-frame');
                if (battleFrame) battleFrame.contentWindow.postMessage({ type: 'battle-data', payload: data }, '*');
                if (myPokemonsFrame) myPokemonsFrame.contentWindow.postMessage({ type: 'character-data', payload: data }, '*');

                const overlay = document.getElementById(ID);
                if (!overlay) return;

                const isCharacterPayload = !!(data.party || data.pc);
                // sinal real de fim de luta: só usado aqui pra saber quando voltar
                // pra aba anterior — battle.js ignora isso de propósito (ele só olha
                // pra presença de `foe`), esse "over" não deve virar estado de tela lá.
                const battleEnded = !!(data.state && data.state.over === true);

                if (isCharacterPayload && !battleEnded) {
                    if (overlay.dataset.activeView !== 'myPokemons') {
                        if (overlay.classList.contains('collapsed')) {
                            setCollapsed(overlay, currentSettings(overlay), false);
                        }
                        setActiveView('myPokemons', overlay);
                    }
                    return;
                }

                if (battleEnded) {
                    const returnView = overlay.dataset.preBattleView;
                    if (returnView) {
                        delete overlay.dataset.preBattleView;
                        if (overlay.classList.contains('collapsed')) {
                            setCollapsed(overlay, currentSettings(overlay), false);
                        }
                        setActiveView(returnView, overlay);
                    }
                    return;
                }

                if (data.foe) {
                    if (overlay.dataset.activeView !== 'battle' && !overlay.dataset.preBattleView) {
                        overlay.dataset.preBattleView = overlay.dataset.activeView || 'calc';
                    }
                    if (overlay.classList.contains('collapsed')) {
                        setCollapsed(overlay, currentSettings(overlay), false);
                    }
                    setActiveView('battle', overlay);
                }
            };

            window.addEventListener('pkmn-helper-battle-data', handleHelperPayload);
            window.addEventListener('pkmn-helper-character-data', handleHelperPayload);
        }
    }

    function injectStyle() {
        if (document.getElementById('pokemon-helper-style')) return;

        if (!document.getElementById('pokemon-helper-pixel-theme')) {
            const link = document.createElement('link');
            link.id = 'pokemon-helper-pixel-theme';
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('pixel-theme.css');
            document.head.appendChild(link);
        }

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
                font-family: 'Press Start 2P', 'Courier New', ui-monospace, monospace;
                border: 3px solid #000;
                border-radius: 0;
                overflow: hidden;
                box-shadow: 4px 4px 0 0 #000;
            }
            #${ID} .ph-bubble {
                display: none;
                font-size: 20px;
            }
            #${ID}.collapsed {
                width: 48px !important;
                height: 48px !important;
                min-width: 0 !important;
                min-height: 0 !important;
                border-radius: 0;
                border: 0;
                box-shadow: none;
            }
            #${ID}.collapsed .ph-bubble { display: flex; }
            #${ID}.collapsed .ph-header,
            #${ID}.collapsed .ph-body { display: none !important; }
            #${ID} .ph-header {
                display: flex;
                align-items: center;
                flex: 0 0 auto;
                background: #1c1f28;
                border-bottom: 2px solid #000;
                gap: 4px;
                padding: 4px;
                cursor: move;
                user-select: none;
            }
            #${ID} .ph-icon-btn {
                flex: 0 0 auto;
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
                font-size: var(--pxl-fs-sm);
                box-sizing: border-box;
            }
            #${ID} .ph-settings h3 {
                font-size: var(--pxl-fs-xs);
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #9198ab;
                margin: 0 0 8px;
            }
            #${ID} .ph-btn-shortcut { width: 100%; margin-bottom: 4px; }
            #${ID} .ph-hint { color: #9198ab; font-size: var(--pxl-fs-sm); margin: 4px 0 14px; }
            #${ID} .ph-resize-handle {
                position: absolute;
                z-index: 10;
            }
            #${ID}.collapsed .ph-resize-handle { display: none; }
            #${ID} .ph-resize-n, #${ID} .ph-resize-s {
                left: 6px;
                right: 6px;
                height: 6px;
                cursor: ns-resize;
            }
            #${ID} .ph-resize-n { top: 0; }
            #${ID} .ph-resize-s { bottom: 0; }
            #${ID} .ph-resize-e, #${ID} .ph-resize-w {
                top: 6px;
                bottom: 6px;
                width: 6px;
                cursor: ew-resize;
            }
            #${ID} .ph-resize-e { right: 0; }
            #${ID} .ph-resize-w { left: 0; }
            #${ID} .ph-resize-ne, #${ID} .ph-resize-nw, #${ID} .ph-resize-se, #${ID} .ph-resize-sw {
                width: 12px;
                height: 12px;
            }
            #${ID} .ph-resize-ne {
                top: 0;
                right: 0;
                cursor: nesw-resize;
                background: linear-gradient(45deg, transparent 50%, #9198ab 50%);
            }
            #${ID} .ph-resize-nw {
                top: 0;
                left: 0;
                cursor: nwse-resize;
                background: linear-gradient(315deg, transparent 50%, #9198ab 50%);
            }
            #${ID} .ph-resize-se {
                bottom: 0;
                right: 0;
                cursor: nwse-resize;
                background: linear-gradient(135deg, transparent 50%, #9198ab 50%);
            }
            #${ID} .ph-resize-sw {
                bottom: 0;
                left: 0;
                cursor: nesw-resize;
                background: linear-gradient(225deg, transparent 50%, #9198ab 50%);
            }
        `;
        document.head.appendChild(style);
    }

    function buildSettingsPanel() {
        const panel = document.createElement('div');
        panel.className = 'ph-settings';
        panel.id = 'pokemon-settings-panel';
        panel.innerHTML = `
            <h3>Atalho de teclado</h3>
            <button type="button" class="ph-btn-shortcut pxl-btn pxl-btn-sm" id="ph-set-shortcut">Configurar atalho de abrir/fechar</button>
            <p class="ph-hint">Abre a página de atalhos do Chrome, onde dá pra definir a combinação de teclas que abre e fecha esta extensão em qualquer aba.</p>
        `;

        panel.querySelector('#ph-set-shortcut').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'pkmn-helper-open-shortcuts' });
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
        persist(currentSettings(container));
    }

    function currentSettings(container) {
        return {
            top: parseInt(container.style.top, 10) || DEFAULT_SETTINGS.top,
            right: parseInt(container.style.right, 10) || DEFAULT_SETTINGS.right,
            width: parseInt(container.style.width, 10) || DEFAULT_SETTINGS.width,
            height: parseInt(container.style.height, 10) || DEFAULT_SETTINGS.height,
            collapsed: container.classList.contains('collapsed'),
            view: container.dataset.activeView || DEFAULT_SETTINGS.view,
            open: true,
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
        const myPokemons = container.querySelector('#pokemon-myPokemons-frame');
        const chart = container.querySelector('#pokemon-chart-frame');
        const settingsPanel = container.querySelector('#pokemon-settings-panel');
        if (!calc || !battle || !myPokemons || !chart || !settingsPanel) return;

        calc.style.display = view === 'calc' ? 'block' : 'none';
        battle.style.display = view === 'battle' ? 'block' : 'none';
        myPokemons.style.display = view === 'myPokemons' ? 'block' : 'none';
        chart.style.display = view === 'chart' ? 'block' : 'none';
        settingsPanel.style.display = view === 'settings' ? 'block' : 'none';

        container.querySelectorAll('.ph-view-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        container.dataset.activeView = view;
        persist(currentSettings(container));
    }
})();
