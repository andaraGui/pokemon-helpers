(function () {
    const ID = 'pokemon-type-matchup-overlay';
    const DEFAULT_SETTINGS = PokemonHelperStorage.DEFAULT_OVERLAY_SETTINGS;
    const MIN_WIDTH = 220;
    const MIN_HEIGHT = 180;
    const BATTLE_RETURN_DELAY_MS = 4000;
    const FLEE_RETURN_DELAY_MS = 1000;
    let battleReturnTimer = null;
    let dataSeen = false;

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

    PokemonHelperStorage.getOverlaySettings().then((storedSettings) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        const settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings);
        if (mode === 'ensure' && settings.open === false) return;
        settings.open = true;
        build(settings);
    }).catch((error) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        console.warn('[Pokemon Helper] Não foi possível carregar as configurações:', error);
        build(Object.assign({}, DEFAULT_SETTINGS, { open: true }));
    });

    function build(settings) {
        injectStyle();

        const container = document.createElement('div');
        container.id = ID;
        // referência ao MESMO objeto `settings` que arrastar/redimensionar/
        // maximizar mutam neste build() — o painel de configurações (função
        // separada, sem acesso a este closure) usa isso pra editar o estado
        // real em vez de uma cópia desconectada (currentSettings() lida do
        // DOM só devolve uma leitura pontual, não o objeto vivo).
        container.__phSettings = settings;
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

        const { collapseBtn, maximizeBtn } = buildHeaderButtons(header, [
            { icon: 'enc', tip: 'Encontro atual — tecla E', view: 'battle' },
            { icon: 'calc', tip: 'Calculadora de tipos — tecla C', view: 'calc' },
            { icon: 'team', tip: 'Meus Pokémon — tecla M', view: 'myPokemons' },
            { icon: 'cfg', tip: 'Configurações — vírgula', view: 'settings' },
        ], { tip: 'Minimizar — Esc' });

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

        const statusBar = document.createElement('div');
        statusBar.className = 'ph-status';
        statusBar.innerHTML = '<div class="ph-status-dot"></div><div class="ph-status-text"></div>';

        container.appendChild(bubble);
        container.appendChild(header);
        container.appendChild(body);
        container.appendChild(statusBar);
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

        container.dataset.maximized = String(settings.maximized === true);
        container.dataset.restoreWidth = String(settings.restoreWidth || '');
        container.dataset.restoreRight = String(settings.restoreRight ?? '');
        setCollapsed(container, settings, settings.collapsed);
        setActiveView(settings.view || 'calc', container);

        bubble.addEventListener('click', () => setCollapsed(container, settings, false));
        collapseBtn.addEventListener('click', () => setCollapsed(container, settings, true));
        maximizeBtn.setAttribute('aria-label', settings.maximized ? 'Voltar ao tamanho anterior' : 'Maximizar para 90% da largura');
        maximizeBtn.addEventListener('click', () => {
            if (!settings.maximized) {
                settings.restoreWidth = settings.width;
                settings.restoreRight = settings.right;
                settings.width = Math.round(window.innerWidth * 0.9);
                settings.right = Math.round(window.innerWidth * 0.05);
                settings.maximized = true;
            } else {
                settings.width = settings.restoreWidth || DEFAULT_SETTINGS.width;
                settings.right = settings.restoreRight ?? DEFAULT_SETTINGS.right;
                settings.maximized = false;
            }
            container.dataset.maximized = String(settings.maximized);
            container.dataset.restoreWidth = String(settings.restoreWidth || '');
            container.dataset.restoreRight = String(settings.restoreRight ?? '');
            applyBox(container, settings);
            maximizeBtn.setAttribute('aria-label', settings.maximized ? 'Voltar ao tamanho anterior' : 'Maximizar para 90% da largura');
            persist(currentSettings(container));
            syncFullSide(container, settings);
            updateStatus(container, settings);
        });

        header.addEventListener('click', (e) => {
            const btn = e.target.closest('.ph-view-btn');
            if (!btn) return;
            delete container.dataset.preBattleView; // navegação manual cancela o retorno automático
            setActiveView(btn.dataset.view, container);
        });

        const SHORTCUT_VIEWS = { e: 'battle', c: 'calc', t: 'calc', m: 'myPokemons', ',': 'settings' };
        function handleShortcut(key) {
            const container = document.getElementById(ID);
            if (!container || container.classList.contains('collapsed')) return;
            const settings = currentSettings(container);
            if (SHORTCUT_VIEWS[key]) {
                delete container.dataset.preBattleView;
                setActiveView(SHORTCUT_VIEWS[key], container);
            } else if (key === 'f') {
                container.querySelector('.ph-maximize-btn')?.click();
            } else if (key === 'escape') {
                if (settings.maximized) container.querySelector('.ph-maximize-btn')?.click();
                else setCollapsed(container, settings, true);
            }
        }
        // atalhos só valem com o evento no painel (nunca no documento do jogo —
        // o jogo usa essas teclas pra gameplay)
        container.addEventListener('keydown', (event) => {
            if (/INPUT|TEXTAREA/.test(event.target.tagName)) return;
            handleShortcut(event.key.toLowerCase());
        });
        // registrado uma única vez em `window` (persiste entre toggles da
        // extensão, ao contrário do `container`, que é recriado do zero a cada
        // vez) — sem essa guarda, cada toggle empilharia mais um listener e um
        // único atalho vindo de iframe acabaria disparando handleShortcut
        // várias vezes (ex.: F maximizando e desmaximizando na mesma tecla).
        if (!window.__pkmnHelperShortcutListenerAdded) {
            window.__pkmnHelperShortcutListenerAdded = true;
            window.addEventListener('message', (event) => {
                const data = event.data;
                if (!data || typeof data !== 'object') return;
                if (data.type === 'panel-shortcut') handleShortcut(String(data.key).toLowerCase());
                if (data.type === 'panel-exit-full') {
                    const overlay = document.getElementById(ID);
                    const settings = overlay && currentSettings(overlay);
                    if (settings?.maximized) overlay.querySelector('.ph-maximize-btn')?.click();
                }
            });
        }

        if (!window.__pkmnHelperPayloadListenerAdded) {
            window.__pkmnHelperPayloadListenerAdded = true;

            const handleHelperPayload = (ev) => {
                const overlay = document.getElementById(ID);
                if (!overlay) return;
                dataSeen = true;
                updateStatus(overlay, currentSettings(overlay));

                const data = ev.detail;
                const battleFrame = document.getElementById('pokemon-battle-frame');
                const myPokemonsFrame = document.getElementById('pokemon-myPokemons-frame');
                if (battleFrame) battleFrame.contentWindow.postMessage({ type: 'battle-data', payload: data }, '*');
                if (myPokemonsFrame) myPokemonsFrame.contentWindow.postMessage({ type: 'character-data', payload: data }, '*');

                const isCharacterPayload = !!(data.party || data.pc);
                // sinal real de fim de luta: só usado aqui pra saber quando voltar
                // pra aba anterior — battle.js ignora isso de propósito (ele só olha
                // pra presença de `foe`), esse "over" não deve virar estado de tela lá.
                const battleEnded = !!(data.state && data.state.over === true);
                const isBattlePayload = !!(data.foe || data.state?.foe?.mon || data.battleId);

                if (isCharacterPayload && !battleEnded) {
                    // só troca sozinho a partir da view ociosa (calc); assim não
                    // atropela navegação manual pra outras abas (config, tabela...).
                    if ((overlay.dataset.activeView || 'calc') === 'calc') {
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
                        const fledSuccessfully = data.state?.outcome === 'fled'
                            || (data.events || []).some((event) => event.t === 'flee' && event.ok === true);
                        const returnDelay = fledSuccessfully ? FLEE_RETURN_DELAY_MS : BATTLE_RETURN_DELAY_MS;
                        if (battleReturnTimer) clearTimeout(battleReturnTimer);
                        battleReturnTimer = setTimeout(() => {
                            battleReturnTimer = null;
                            if (overlay.dataset.preBattleView !== returnView) return;
                            delete overlay.dataset.preBattleView;
                            if (overlay.classList.contains('collapsed')) {
                                setCollapsed(overlay, currentSettings(overlay), false);
                            }
                            setActiveView(returnView, overlay);
                        }, returnDelay);
                    }
                    return;
                }

                if (isBattlePayload) {
                    if (battleReturnTimer) {
                        clearTimeout(battleReturnTimer);
                        battleReturnTimer = null;
                    }
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

        updateStatus(container, settings);
        PokemonHelperTooltip.attach(document);
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
                position: fixed; z-index: 2147483647;
                display: flex; flex-direction: column;
                background: #0d0d14; color: #e6e6f0;
                font-family: 'Pixelify Sans', monospace;
                border: 2px solid #23232f; border-radius: 0;
                overflow: hidden; box-shadow: -8px 0 0 rgba(0,0,0,.35);
                image-rendering: pixelated;
            }
            #${ID} .ph-header {
                display: flex; align-items: center; gap: 3px;
                height: 34px; padding: 0 4px; flex: 0 0 auto;
                background: #08080d; border-bottom: 2px solid #1c1c26;
                cursor: move; user-select: none;
            }
            #${ID} .ph-icon-btn {
                width: 30px; height: 26px; flex: 0 0 auto;
                display: flex; align-items: center; justify-content: center;
                border: 1px solid #23232f; padding: 0; background: #12121b;
                cursor: pointer;
            }
            #${ID} .ph-view-btn.active { background: #ffb545; border-color: #ffb545; }
            #${ID} .ph-collapse-btn {
                width: 26px; align-items: flex-end; padding-bottom: 4px;
                color: #8a8aa0; font-family: 'Silkscreen', monospace; font-size: 12px;
            }
            #${ID} .ph-spacer { flex: 1; }
            #${ID} .ph-body { flex: 1; position: relative; min-height: 0; display: flex; }
            #${ID} .ph-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: none; }
            #${ID}.full-side .ph-frame { position: static; height: 100%; }
            #${ID}.full-side #pokemon-chart-frame { display: block; flex: 1 1 auto; min-width: 0; order: 0; }
            #${ID}.full-side .ph-frame.side-active { display: block; flex: 0 0 var(--ph-side-width, 360px); border-left: 2px solid #23232f; order: 1; }
            #${ID} .ph-status {
                flex: 0 0 auto; height: 22px;
                display: flex; align-items: center; gap: 7px; padding: 0 8px;
                background: #08080d; border-top: 1px solid #1c1c26;
            }
            #${ID} .ph-status-dot { width: 6px; height: 6px; background: #63bb5b; animation: ph-blip 1.6s steps(2,end) infinite; }
            @keyframes ph-blip { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
            #${ID} .ph-status-text {
                font-family: 'Silkscreen', monospace; font-size: 9px; letter-spacing: .5px;
                color: #8a8aa0; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
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
            #${ID}.collapsed .ph-body,
            #${ID}.collapsed .ph-status { display: none !important; }
            #${ID} .ph-settings { position: absolute; inset: 0; display: none; overflow-y: auto; padding: 9px 10px 14px; box-sizing: border-box; }
            #${ID} .ph-set-head {
                display: flex; align-items: center; gap: 7px; margin: 11px 0 8px;
                font-family: 'Silkscreen', monospace; font-size: 10px; color: #8a8aa0; letter-spacing: 1.5px;
            }
            #${ID} .ph-set-head:first-child { margin-top: 0; }
            #${ID} .ph-set-head::after { content: ''; flex: 1; height: 1px; background: #1c1c26; }
            #${ID} .ph-setting-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
            #${ID} .ph-setting-row[hidden] { display: none; }
            #${ID} .ph-setting-label { flex: 1; font-size: 15px; color: #c8c8dc; }
            #${ID} .ph-step { width: 26px; height: 24px; background: #16161f; border: 1px solid #2b2b39; color: #c8c8dc; font-family: 'Silkscreen', monospace; font-size: 11px; padding: 0; cursor: pointer; }
            #${ID} .ph-width-value { font-family: 'Silkscreen', monospace; font-size: 11px; color: #ffb545; width: 44px; text-align: center; }
            #${ID} .ph-toggle { position: relative; flex: 0 0 auto; width: 40px; height: 22px; padding: 0; border: 1px solid #2b2b39; border-radius: 0; background: #16161f; cursor: pointer; }
            #${ID} .ph-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #8a8aa0; transition: transform .15s ease; }
            #${ID} .ph-toggle[aria-checked="true"] { background: #3f8f5a; }
            #${ID} .ph-toggle[aria-checked="true"]::after { background: #0c0c11; transform: translateX(18px); }
            #${ID} .ph-shortcut-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; margin-bottom: 10px; }
            #${ID} .ph-key { font-family: 'Silkscreen', monospace; font-size: 11px; color: #ffb545; background: #1a1a24; border: 1px solid #2b2b39; padding: 3px 7px; text-align: center; }
            #${ID} .ph-key-desc { font-size: 15px; color: #8a8aa0; }
            #${ID} .ph-hint { color: #8a8aa0; font-size: 13px; margin: 4px 0 12px; }
            #${ID} .ph-btn-shortcut { width: 100%; }
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
                background: linear-gradient(45deg, transparent 50%, #8a8aa0 50%);
            }
            #${ID} .ph-resize-nw {
                top: 0;
                left: 0;
                cursor: nwse-resize;
                background: linear-gradient(315deg, transparent 50%, #8a8aa0 50%);
            }
            #${ID} .ph-resize-se {
                bottom: 0;
                right: 0;
                cursor: nwse-resize;
                background: linear-gradient(135deg, transparent 50%, #8a8aa0 50%);
            }
            #${ID} .ph-resize-sw {
                bottom: 0;
                left: 0;
                cursor: nesw-resize;
                background: linear-gradient(225deg, transparent 50%, #8a8aa0 50%);
            }
        `;
        document.head.appendChild(style);
    }

    function buildSettingsPanel() {
        const panel = document.createElement('div');
        panel.className = 'ph-settings';
        panel.id = 'pokemon-settings-panel';
        panel.innerHTML = `
            <div class="ph-set-head" data-tip="Ajustes do painel">PAINEL</div>
            <div class="ph-setting-row" data-tip="Largura do painel encaixado, de 250 a 380 px.">
                <span class="ph-setting-label">Largura</span>
                <button type="button" class="ph-step" id="ph-width-minus">-</button>
                <span class="ph-width-value" id="ph-width-value"></span>
                <button type="button" class="ph-step" id="ph-width-plus">+</button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-update-notifications-label">Avisar sobre atualizações</span>
                <button type="button" class="ph-toggle" id="ph-update-notifications" role="switch" aria-checked="false" aria-labelledby="ph-update-notifications-label"></button>
            </div>
            <div class="ph-setting-row" id="ph-beta-channel-row" hidden>
                <span class="ph-setting-label" id="ph-beta-channel-label">Canal beta</span>
                <button type="button" class="ph-toggle" id="ph-beta-channel" role="switch" aria-checked="false" aria-labelledby="ph-beta-channel-label"></button>
            </div>
            <div class="ph-setting-row" data-tip="Desligue se as dicas atrapalharem durante a batalha.">
                <span class="ph-setting-label" id="ph-tooltips-label">Tooltips ao passar o mouse</span>
                <button type="button" class="ph-toggle" id="ph-tooltips" role="switch" aria-checked="true" aria-labelledby="ph-tooltips-label"></button>
            </div>
            <div class="ph-set-head">ATALHOS</div>
            <div class="ph-shortcut-grid">
                ${[['E', 'Encontro atual'], ['C', 'Calculadora de tipos'], ['M', 'Meus Pokémon'], [',', 'Configurações'],
                   ['F', 'Expandir / tabela completa'], ['ESC', 'Minimizar / voltar']]
                    .map(([k, v]) => `<span class="ph-key">${k}</span><span class="ph-key-desc">${v}</span>`).join('')}
            </div>
            <p class="ph-hint">Os atalhos valem com o mouse/foco sobre o painel.</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-set-shortcut">Configurar atalho do navegador</button>
            <p class="ph-hint">Abre a página de atalhos do Chrome, onde dá pra definir a combinação que abre e fecha a extensão.</p>
        `;

        panel.querySelector('#ph-set-shortcut').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'pkmn-helper-open-shortcuts' });
        });

        const notificationsToggle = panel.querySelector('#ph-update-notifications');
        const betaToggle = panel.querySelector('#ph-beta-channel');
        const betaRow = panel.querySelector('#ph-beta-channel-row');

        function setToggleState(toggle, enabled) {
            toggle.setAttribute('aria-checked', String(enabled));
        }

        function applyUpdatePreferences(preferences) {
            setToggleState(notificationsToggle, preferences.notificationsEnabled);
            setToggleState(betaToggle, preferences.betaChannelEnabled);
            betaRow.hidden = !preferences.notificationsEnabled;
        }

        PokemonHelperStorage.getUpdatePreferences()
            .then(applyUpdatePreferences)
            .catch((error) => console.warn('[Pokemon Helper] Não foi possível carregar preferências de atualização:', error));

        notificationsToggle.addEventListener('click', () => {
            const notificationsEnabled = notificationsToggle.getAttribute('aria-checked') !== 'true';
            setToggleState(notificationsToggle, notificationsEnabled);
            betaRow.hidden = !notificationsEnabled;
            PokemonHelperStorage.setUpdatePreferences({ notificationsEnabled }).catch((error) => {
                setToggleState(notificationsToggle, !notificationsEnabled);
                betaRow.hidden = notificationsEnabled;
                console.warn('[Pokemon Helper] Não foi possível salvar a preferência de atualização:', error);
            });
        });

        betaToggle.addEventListener('click', () => {
            const betaChannelEnabled = betaToggle.getAttribute('aria-checked') !== 'true';
            setToggleState(betaToggle, betaChannelEnabled);
            PokemonHelperStorage.setUpdatePreferences({ betaChannelEnabled }).catch((error) => {
                setToggleState(betaToggle, !betaChannelEnabled);
                console.warn('[Pokemon Helper] Não foi possível salvar a preferência do beta:', error);
            });
        });

        // "largura" no painel de config é sempre a largura ENCAIXADA — com o
        // painel expandido (F) não existe uma largura encaixada visível, então
        // mostramos/editamos o valor guardado em `restoreWidth` (o que volta
        // a valer quando o usuário sair do modo expandido).
        function dockedWidth(settings) {
            return settings.maximized ? (settings.restoreWidth || DEFAULT_SETTINGS.width) : settings.width;
        }

        const widthValue = panel.querySelector('#ph-width-value');
        function applyWidth(delta) {
            const container = document.getElementById(ID);
            // usa o MESMO objeto que arrastar/redimensionar/maximizar mutam
            // (container.__phSettings), nunca uma cópia via currentSettings() —
            // senão a próxima ação nesses outros caminhos reverte e persiste
            // por cima da edição feita aqui.
            const settings = container && container.__phSettings;
            if (!container || !settings) return;
            if (settings.maximized) {
                settings.restoreWidth = clampNum(dockedWidth(settings) + delta, 250, 380, dockedWidth(settings));
                container.dataset.restoreWidth = String(settings.restoreWidth);
                syncFullSide(container, settings); // atualiza --ph-side-width já, pro caso o modo lado a lado esteja ativo
            } else {
                settings.width = clampNum(settings.width + delta, 250, 380, settings.width);
                applyBox(container, settings);
            }
            widthValue.textContent = `${dockedWidth(settings)}px`;
            updateStatus(container, settings);
            persist(currentSettings(container));
        }
        panel.querySelector('#ph-width-minus').addEventListener('click', () => applyWidth(-20));
        panel.querySelector('#ph-width-plus').addEventListener('click', () => applyWidth(20));
        widthValue.textContent = '—';
        setTimeout(() => { // preenche após o container existir
            const container = document.getElementById(ID);
            const settings = container && container.__phSettings;
            if (settings) widthValue.textContent = `${dockedWidth(settings)}px`;
        });

        const tooltipsToggle = panel.querySelector('#ph-tooltips');
        PokemonHelperStorage.getUiPreferences()
            .then((preferences) => setToggleState(tooltipsToggle, preferences.tooltipsEnabled))
            .catch(() => {});
        tooltipsToggle.addEventListener('click', () => {
            const tooltipsEnabled = tooltipsToggle.getAttribute('aria-checked') !== 'true';
            setToggleState(tooltipsToggle, tooltipsEnabled);
            PokemonHelperStorage.setUiPreferences({ tooltipsEnabled }).catch((error) => {
                setToggleState(tooltipsToggle, !tooltipsEnabled);
                console.warn('[Pokemon Helper] Não foi possível salvar a preferência de tooltips:', error);
            });
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

    function updateStatus(container, settings) {
        const text = container.querySelector('.ph-status-text');
        if (!text) return;
        const mode = settings.maximized ? 'EXPANDIDO' : `ENCAIXADO ${settings.width}PX`;
        text.textContent = `${dataSeen ? 'CONECTADO' : 'AGUARDANDO DADOS'} · ${mode} · F=EXPANDIR  ESC=MINIMIZAR`;
    }

    function syncFullSide(container, settings) {
        const view = container.dataset.activeView || 'calc';
        // lado a lado só pra views em iframe de conteúdo: 'settings' é um <div>
        // absoluto (cobriria a tabela) e 'chart'/'myPokemons' ocupam tudo sozinhos
        const sideBySide = settings.maximized === true && (view === 'calc' || view === 'battle');
        container.classList.toggle('full-side', sideBySide);
        container.style.setProperty('--ph-side-width', `${settings.restoreWidth || DEFAULT_SETTINGS.width}px`);
        container.querySelectorAll('.ph-frame').forEach((frame) => frame.classList.remove('side-active'));
        if (sideBySide) {
            const active = container.querySelector(`#pokemon-${view}-frame`);
            if (active) active.classList.add('side-active');
        }
        // só reposta pros iframes quando o estado de fato muda — setActiveView
        // roda a cada payload de batalha (uma vez por turno), então sem essa
        // guarda o postMessage inundaria os iframes com a mesma mensagem
        // repetida durante uma luta inteira.
        const full = settings.maximized === true;
        const signature = `${full}|${sideBySide}`;
        if (container.__phFullSignature === signature) return;
        container.__phFullSignature = signature;
        container.querySelectorAll('.ph-frame').forEach((frame) => {
            frame.contentWindow?.postMessage({ type: 'panel-mode', full }, '*');
        });
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
            maximized: container.dataset.maximized === 'true',
            restoreWidth: parseInt(container.dataset.restoreWidth, 10) || null,
            restoreRight: container.dataset.restoreRight === '' ? null : parseInt(container.dataset.restoreRight, 10),
            collapsed: container.classList.contains('collapsed'),
            view: container.dataset.activeView || DEFAULT_SETTINGS.view,
            open: true,
        };
    }

    function persist(settings) {
        PokemonHelperStorage.setOverlaySettings(settings).catch((error) => {
            console.warn('[Pokemon Helper] Não foi possível salvar as configurações:', error);
        });
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

        container.dataset.activeView = view;
        syncFullSide(container, currentSettings(container));

        // no modo lado a lado (.full-side), o frame ativo (.side-active) e a
        // tabela (#pokemon-chart-frame) são exibidos via CSS — o laço não pode
        // forçar display:none neles (isso venceria a regra do stylesheet, já
        // que estilo inline sempre tem prioridade). Em vez de simplesmente
        // pular esses dois casos, o laço limpa (`''`) o estilo inline deles
        // sempre que não são a view ativa "sozinha": assim a folha de estilo
        // decide sozinha (nada de display:none preso de uma navegação anterior
        // sobrevivendo até o próximo toggle de F, que não passa por este laço).
        [calc, battle, myPokemons, chart].forEach((frame) => {
            const active = frame.id === `pokemon-${view}-frame`;
            const cssManaged = frame === chart || frame.classList.contains('side-active');
            frame.style.display = active ? 'block' : (cssManaged ? '' : 'none');
        });
        settingsPanel.style.display = view === 'settings' ? 'block' : 'none';

        paintHeaderButtons(container, view);

        persist(currentSettings(container));
    }
})();
