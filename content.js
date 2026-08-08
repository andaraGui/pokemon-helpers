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

    Promise.all([
        PokemonHelperStorage.getOverlaySettings(),
        PokemonHelperStorage.getUiPreferences()
    ]).then(([storedSettings, prefs]) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        window.__pkmnHelperUiPrefs = prefs;
        const settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings);
        if (mode === 'ensure' && settings.open === false) return;
        settings.open = true;
        // preferências de abertura: 'last'/'remember' preservam o comportamento
        // atual (usa o que está persistido em overlaySettings)
        if (prefs.startView !== 'last') settings.view = prefs.startView;
        if (prefs.startCollapsed !== 'remember') settings.collapsed = prefs.startCollapsed === 'collapsed';
        build(settings);
    }).catch((error) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        console.warn('[Pokemon Helper] Não foi possível carregar as configurações:', error);
        window.__pkmnHelperUiPrefs = window.__pkmnHelperUiPrefs || PokemonHelperStorage.DEFAULT_UI_PREFERENCES;
        build(Object.assign({}, DEFAULT_SETTINGS, { open: true }));
    });

    function uiPrefs() {
        return window.__pkmnHelperUiPrefs || PokemonHelperStorage.DEFAULT_UI_PREFERENCES;
    }

    if (!window.__pkmnHelperPrefsListenerAdded) {
        window.__pkmnHelperPrefsListenerAdded = true;
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
            PokemonHelperStorage.getUiPreferences().then((prefs) => {
                window.__pkmnHelperUiPrefs = prefs;
                const container = document.getElementById(ID);
                if (container) refreshShortcutLabels(container);
            });
        });
    }

    // Pós-atualização (atualizar.bat/ZIP): pede ao service worker pra
    // comparar a versão do manifest no disco com a carregada e se
    // recarregar se houver versão nova. No retorno de foco porque é o
    // momento típico de voltar do script pro navegador.
    if (!window.__pkmnHelperDiskCheckAdded) {
        window.__pkmnHelperDiskCheckAdded = true;
        const requestDiskCheck = () => {
            try {
                const maybePromise = chrome.runtime.sendMessage({ type: 'pkmn-helper-check-disk-version' });
                if (maybePromise && maybePromise.catch) maybePromise.catch(() => {});
            } catch (error) {
                // contexto invalidado (extensão já se recarregou) — o guard
                // do storage orienta o F5; nada a fazer aqui
            }
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') requestDiskCheck();
        });
        window.addEventListener('focus', requestDiskCheck);
        requestDiskCheck();
    }

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

        const fmt = PokemonHelperShortcutUtils.formatCombo;
        const shortcuts = uiPrefs().shortcuts;
        const { collapseBtn, maximizeBtn } = buildHeaderButtons(header, [
            { icon: 'enc', tip: `Encontro atual — tecla ${fmt(shortcuts.battle)}`, view: 'battle' },
            { icon: 'calc', tip: `Calculadora de tipos — tecla ${fmt(shortcuts.calc)}`, view: 'calc' },
            { icon: 'team', tip: `Meus Pokémon — tecla ${fmt(shortcuts.myPokemons)}`, view: 'myPokemons' },
            { icon: 'cfg', tip: `Configurações — tecla ${fmt(shortcuts.settings)}`, view: 'settings' },
        ], { tip: `Minimizar — ${fmt(shortcuts.minimize)}` }, { tip: `Expandir — ${fmt(shortcuts.toggleFull)}` });

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

        const settingsPanel = buildSettingsPanel({
            getContainer: () => document.getElementById(ID),
            dockedWidth, clampNum, applyBox, syncFullSide,
            updateStatus, persist, currentSettings
        });

        // syncFullSide (chamado no build()) roda ANTES desses iframes
        // terminarem de carregar, e a guarda de assinatura em __phFullSignature
        // suprime reenvios quando o estado não muda — então um 'maximized'
        // persistido do storage nunca chega no iframe recém-criado por aquele
        // caminho. Cada frame recebe seu próprio postMessage direto assim que
        // carrega, sem passar pela guarda, com o estado atual lido do MESMO
        // objeto `settings` que o resto do build() usa.
        [calcFrame, battleFrame, myPokemonsFrame, chartFrame].forEach((frame) => {
            frame.addEventListener('load', () => {
                frame.contentWindow?.postMessage({ type: 'panel-mode', full: settings.maximized === true }, '*');
            });
        });

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
                    updateStatus(container, settings);
                    const widthValue = container.querySelector('#ph-width-value');
                    if (widthValue) widthValue.textContent = `${dockedWidth(settings)}px`;
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });

        container.dataset.maximized = String(settings.maximized === true);
        container.dataset.restoreWidth = String(settings.restoreWidth || '');
        container.dataset.restoreRight = String(settings.restoreRight ?? '');
        container.dataset.restoreTop = String(settings.restoreTop ?? '');
        container.dataset.restoreHeight = String(settings.restoreHeight || '');
        setCollapsed(container, settings, settings.collapsed);
        setActiveView(settings.view || 'calc', container);

        bubble.addEventListener('click', () => setCollapsed(container, settings, false));
        collapseBtn.addEventListener('click', () => setCollapsed(container, settings, true));
        maximizeBtn.setAttribute('aria-label', settings.maximized ? 'Voltar ao tamanho anterior' : 'Maximizar para 90% da largura');
        maximizeBtn.addEventListener('click', () => {
            if (!settings.maximized) {
                settings.restoreWidth = settings.width;
                settings.restoreRight = settings.right;
                settings.restoreTop = settings.top;
                settings.restoreHeight = settings.height;
                // expande nas DUAS dimensões — o modo full ocupa ~90% da
                // viewport inteira, não só da largura (senão a tabela 18×18
                // fica espremida numa faixa baixa e os controles do topo
                // somem do viewport ao rolar)
                settings.width = Math.round(window.innerWidth * 0.9);
                settings.right = Math.round(window.innerWidth * 0.05);
                settings.top = Math.round(window.innerHeight * 0.05);
                settings.height = Math.round(window.innerHeight * 0.9);
                settings.maximized = true;
            } else {
                settings.width = settings.restoreWidth || DEFAULT_SETTINGS.width;
                settings.right = settings.restoreRight ?? DEFAULT_SETTINGS.right;
                settings.top = settings.restoreTop ?? DEFAULT_SETTINGS.top;
                settings.height = settings.restoreHeight || DEFAULT_SETTINGS.height;
                settings.maximized = false;
            }
            container.dataset.maximized = String(settings.maximized);
            container.dataset.restoreWidth = String(settings.restoreWidth || '');
            container.dataset.restoreRight = String(settings.restoreRight ?? '');
            container.dataset.restoreTop = String(settings.restoreTop ?? '');
            container.dataset.restoreHeight = String(settings.restoreHeight || '');
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

        // cliques no shell (cabeçalho, botões) focam o elemento clicado e
        // "roubam" o teclado do jogo — devolve o foco após o clique. Exceção:
        // aba Configurações, onde inputs e captura de atalho precisam de foco.
        container.addEventListener('click', () => {
            if (container.dataset.activeView === 'settings') return;
            const active = document.activeElement;
            if (active && container.contains(active) && !/INPUT|TEXTAREA|SELECT/.test(active.tagName)) active.blur();
        });

        // a tabela 18×18 só aparece no modo expandido, ao lado das views de
        // conteúdo (syncFullSide) — estas são as views que a exibem
        const CHART_HOST_VIEWS = ['calc', 'battle'];
        const VIEW_ACTIONS = { battle: 'battle', calc: 'calc', myPokemons: 'myPokemons', settings: 'settings' };

        // retorna true quando de fato executou algo, false quando não fez nada
        // (ex.: painel colapsado ignora toggleFull/minimize) — quem consome a
        // tecla no listener global usa esse retorno pra saber se deve mesmo
        // impedir que o jogo a receba
        function performAction(action) {
            const container = document.getElementById(ID);
            if (!container) return false;
            if (container.classList.contains('collapsed')) {
                // da bolha, atalho de view expande e abre a aba;
                // toggleFull/minimize não fazem sentido colapsado
                if (!VIEW_ACTIONS[action] && action !== 'typeChart') return false;
                setCollapsed(container, currentSettings(container), false);
            }
            const settings = currentSettings(container);
            if (VIEW_ACTIONS[action]) {
                delete container.dataset.preBattleView;
                setActiveView(VIEW_ACTIONS[action], container);
                return true;
            }
            if (action === 'toggleFull') {
                container.querySelector('.ph-maximize-btn')?.click();
                return true;
            }
            if (action === 'typeChart') {
                // atalho dedicado da tabela de tipos: de qualquer tela, expande
                // o painel já com a tabela à mostra; de novo, volta ao encaixado
                const view = container.dataset.activeView || 'calc';
                if (settings.maximized && CHART_HOST_VIEWS.includes(view)) {
                    container.querySelector('.ph-maximize-btn')?.click();
                } else {
                    delete container.dataset.preBattleView;
                    if (!CHART_HOST_VIEWS.includes(view)) setActiveView('calc', container);
                    if (!settings.maximized) container.querySelector('.ph-maximize-btn')?.click();
                }
                return true;
            }
            if (action === 'minimize') {
                if (settings.maximized) container.querySelector('.ph-maximize-btn')?.click();
                else setCollapsed(container, settings, true);
                return true;
            }
            return false;
        }

        // combo do evento → nome da ação configurada (ou null)
        function actionForCombo(evtLike) {
            const combo = PokemonHelperShortcutUtils.comboFromEvent(evtLike);
            if (!combo) return null;
            const shortcuts = uiPrefs().shortcuts;
            return Object.keys(shortcuts).find((name) => shortcuts[name] === combo) || null;
        }

        // evtLike: KeyboardEvent ou o objeto serializado do shortcut-forwarder
        function handleShortcut(evtLike) {
            const action = actionForCombo(evtLike);
            if (action) performAction(action);
        }
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
                if (data.type === 'panel-shortcut') handleShortcut(data);
                if (data.type === 'panel-exit-full') {
                    const overlay = document.getElementById(ID);
                    const settings = overlay && currentSettings(overlay);
                    if (settings?.maximized) overlay.querySelector('.ph-maximize-btn')?.click();
                }
                if (data.type === 'panel-interaction') {
                    // clique dentro de um iframe do painel moveu o foco pra ele e o
                    // jogo parou de receber teclado — devolve o foco ao documento
                    // do jogo tirando-o do iframe
                    const overlay = document.getElementById(ID);
                    if (!overlay || overlay.dataset.activeView === 'settings') return;
                    const active = document.activeElement;
                    if (active && active.classList && active.classList.contains('ph-frame')) active.blur();
                }
            });
        }
        // atalhos globais: funcionam com o foco no documento do jogo. Tecla que
        // bate com um atalho configurado é CONSUMIDA (o jogo não a vê) — quem
        // quiser reservar uma tecla pro jogo troca o atalho nas Configurações.
        // Capture phase pra agir antes dos listeners do próprio jogo; guarda em
        // window pela mesma razão do bloco acima (o listener fica no document,
        // que sobrevive aos toggles do painel).
        if (!window.__pkmnHelperGlobalShortcutAdded) {
            window.__pkmnHelperGlobalShortcutAdded = true;
            document.addEventListener('keydown', (event) => {
                // segurar a tecla não pode reexecutar a ação ~30x/s nem floodar
                // o chrome.storage com gravações via persist()
                if (event.repeat) return;
                const target = event.target;
                if (target instanceof Element) {
                    // campos de texto (chat do jogo, inputs do painel) ficam imunes
                    if (/INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable) return;
                    // o painel de Configurações vive neste documento (é um <div>,
                    // não iframe) — tecla com foco lá dentro não é atalho
                    if (target.closest('#pokemon-settings-panel')) return;
                }
                const overlay = document.getElementById(ID);
                if (!overlay) return;
                // captura de atalho em andamento: onCaptureKey (settings-panel)
                // também escuta o document em capture phase, mas registrado
                // DEPOIS deste listener — consumir aqui impediria gravar uma
                // tecla que já é atalho de outra ação
                if (overlay.querySelector('.ph-key-btn.capturing')) return;
                const action = actionForCombo(event);
                if (!action) return;
                // só consome a tecla quando a ação de fato aconteceu — senão
                // atalhos como ESC/F com o painel colapsado (onde não fazem
                // nada) viram teclas mortas pro jogo à toa
                if (performAction(action)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
            }, true);
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
                    // usuário pode desligar a troca automática pra aba Encontro;
                    // sem preBattleView setado, o retorno automático também não roda
                    if (uiPrefs().autoSwitchToBattle === false) return;
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
                font-family: 'Silkscreen', monospace;
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
            #${ID}.full-side #pokemon-chart-frame { display: block; flex: 1 1 auto; min-width: 0; order: 1; }
            #${ID}.full-side .ph-frame.side-active { display: block; flex: 0 0 var(--ph-side-width, 360px); border-right: 2px solid #23232f; order: 0; }
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
            #${ID} .ph-setting-label { flex: 1; font-size: 12px; color: #c8c8dc; }
            #${ID} .ph-step { width: 26px; height: 24px; background: #16161f; border: 1px solid #2b2b39; color: #c8c8dc; font-family: 'Silkscreen', monospace; font-size: 11px; padding: 0; cursor: pointer; }
            #${ID} .ph-width-value { font-family: 'Silkscreen', monospace; font-size: 11px; color: #ffb545; width: 44px; text-align: center; }
            #${ID} .ph-toggle { position: relative; flex: 0 0 auto; width: 40px; height: 22px; padding: 0; border: 1px solid #2b2b39; border-radius: 0; background: #16161f; cursor: pointer; }
            #${ID} .ph-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: #8a8aa0; transition: transform .15s ease; }
            #${ID} .ph-toggle[aria-checked="true"] { background: #3f8f5a; }
            #${ID} .ph-toggle[aria-checked="true"]::after { background: #0c0c11; transform: translateX(18px); }
            #${ID} .ph-cycle { min-width: 116px; height: 24px; padding: 0 8px; background: #16161f; border: 1px solid #2b2b39; color: #ffb545; font-family: 'Silkscreen', monospace; font-size: 10px; cursor: pointer; }
            #${ID} .ph-subhead { font-family: 'Silkscreen', monospace; font-size: 9px; color: #63637a; letter-spacing: 1px; margin: 8px 0 6px; }
            #${ID} .ph-shortcut-grid { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; margin-bottom: 10px; }
            #${ID} .ph-key { font-family: 'Silkscreen', monospace; font-size: 11px; color: #ffb545; background: #1a1a24; border: 1px solid #2b2b39; padding: 3px 7px; text-align: center; }
            #${ID} .ph-key-btn { cursor: pointer; min-width: 52px; }
            #${ID} .ph-key-btn.capturing { color: #0c0c11; background: #ffb545; border-color: #ffb545; }
            #${ID} .ph-shortcut-error { color: #e06c60; font-size: 12px; font-family: 'Silkscreen', monospace; min-height: 14px; margin: 0 0 8px; }
            #${ID} .ph-key-desc { font-size: 12px; color: #8a8aa0; }
            #${ID} .ph-hint { color: #8a8aa0; font-size: 11px; margin: 4px 0 12px; }
            #${ID} .ph-btn-shortcut { width: 100%; }
            #${ID} .ph-data-feedback { font-family: 'Silkscreen', monospace; font-size: 10px; min-height: 13px; margin: 6px 0 0; }
            #${ID} .ph-data-feedback.ok { color: #63bb5b; }
            #${ID} .ph-data-feedback.err { color: #e06c60; }
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

    function clampNum(value, min, max, fallback) {
        const n = parseInt(value, 10);
        if (Number.isNaN(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    }

    // "largura" no painel de config é sempre a largura ENCAIXADA — com o
    // painel expandido (F) não existe uma largura encaixada visível, então
    // mostramos/editamos o valor guardado em `restoreWidth` (o que volta
    // a valer quando o usuário sair do modo expandido). Vive no escopo do
    // módulo (não só dentro de buildSettingsPanel) porque o onUp do
    // redimensionamento, em build(), também precisa dele.
    function dockedWidth(settings) {
        return settings.maximized ? (settings.restoreWidth || DEFAULT_SETTINGS.width) : settings.width;
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
        const fmt = PokemonHelperShortcutUtils.formatCombo;
        const shortcuts = uiPrefs().shortcuts;
        text.textContent = `${dataSeen ? 'CONECTADO' : 'AGUARDANDO DADOS'} · ${mode} · ${fmt(shortcuts.toggleFull)}=EXPANDIR  ${fmt(shortcuts.minimize)}=MINIMIZAR`;
    }

    // reaplica os textos que citam teclas — chamado quando os atalhos mudam
    function refreshShortcutLabels(container) {
        const fmt = PokemonHelperShortcutUtils.formatCombo;
        const shortcuts = uiPrefs().shortcuts;
        const tips = {
            battle: `Encontro atual — tecla ${fmt(shortcuts.battle)}`,
            calc: `Calculadora de tipos — tecla ${fmt(shortcuts.calc)}`,
            myPokemons: `Meus Pokémon — tecla ${fmt(shortcuts.myPokemons)}`,
            settings: `Configurações — tecla ${fmt(shortcuts.settings)}`
        };
        container.querySelectorAll('.ph-view-btn').forEach((btn) => {
            if (tips[btn.dataset.view]) btn.dataset.tip = tips[btn.dataset.view];
        });
        const maximizeBtn = container.querySelector('.ph-maximize-btn');
        if (maximizeBtn) maximizeBtn.dataset.tip = `Expandir — ${fmt(shortcuts.toggleFull)}`;
        const collapseBtn = container.querySelector('.ph-collapse-btn');
        if (collapseBtn) collapseBtn.dataset.tip = `Minimizar — ${fmt(shortcuts.minimize)}`;
        updateStatus(container, currentSettings(container));
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
            restoreTop: container.dataset.restoreTop === '' ? null : parseInt(container.dataset.restoreTop, 10),
            restoreHeight: parseInt(container.dataset.restoreHeight, 10) || null,
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
