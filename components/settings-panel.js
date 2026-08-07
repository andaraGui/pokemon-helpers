// ---------------------------------------------------------------------------
// Painel "Configurações" do overlay (content.js): largura do painel encaixado,
// avisos de atualização/beta, tooltips e atalhos. Não tem acesso ao closure
// de content.js — recebe tudo que precisa (leitura/gravação de settings,
// acesso ao container do overlay, prefs vivas) via objeto `shell`.
// ---------------------------------------------------------------------------

function buildSettingsPanel(shell) {
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
            <div class="ph-set-head">COMPORTAMENTO</div>
            <div class="ph-setting-row" data-tip="Qual aba o painel mostra ao carregar a página.">
                <span class="ph-setting-label">View inicial</span>
                <button type="button" class="ph-cycle" id="ph-start-view"></button>
            </div>
            <div class="ph-setting-row" data-tip="Se o painel começa aberto ou como bolha ao carregar a página.">
                <span class="ph-setting-label">Estado ao abrir</span>
                <button type="button" class="ph-cycle" id="ph-start-collapsed"></button>
            </div>
            <div class="ph-setting-row" data-tip="Trocar sozinho pra aba Encontro quando uma batalha começa.">
                <span class="ph-setting-label" id="ph-auto-battle-label">Auto-troca no encontro</span>
                <button type="button" class="ph-toggle" id="ph-auto-battle" role="switch" aria-checked="true" aria-labelledby="ph-auto-battle-label"></button>
            </div>
            <div class="ph-set-head">TELAS</div>
            <div class="ph-subhead">MEUS POKÉMON</div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-mp-groups-label">Grupos já expandidos</span>
                <button type="button" class="ph-toggle" id="ph-mp-groups" role="switch" aria-checked="true" aria-labelledby="ph-mp-groups-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-mp-pokemon-label">Pokémon já expandidos</span>
                <button type="button" class="ph-toggle" id="ph-mp-pokemon" role="switch" aria-checked="false" aria-labelledby="ph-mp-pokemon-label"></button>
            </div>
            <div class="ph-subhead">BATALHA</div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-stats-label">IVs / Stats</span>
                <button type="button" class="ph-toggle" id="ph-bt-stats" role="switch" aria-checked="true" aria-labelledby="ph-bt-stats-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-weak-label">Fraquezas dele</span>
                <button type="button" class="ph-toggle" id="ph-bt-weak" role="switch" aria-checked="true" aria-labelledby="ph-bt-weak-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-moves-label">Golpes dele</span>
                <button type="button" class="ph-toggle" id="ph-bt-moves" role="switch" aria-checked="true" aria-labelledby="ph-bt-moves-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-balls-label">Pokébolas</span>
                <button type="button" class="ph-toggle" id="ph-bt-balls" role="switch" aria-checked="true" aria-labelledby="ph-bt-balls-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-stages-label">Atributos alterados</span>
                <button type="button" class="ph-toggle" id="ph-bt-stages" role="switch" aria-checked="true" aria-labelledby="ph-bt-stages-label"></button>
            </div>
            <div class="ph-setting-row">
                <span class="ph-setting-label" id="ph-bt-mymoves-label">Seus golpes</span>
                <button type="button" class="ph-toggle" id="ph-bt-mymoves" role="switch" aria-checked="true" aria-labelledby="ph-bt-mymoves-label"></button>
            </div>
            <div class="ph-set-head">ATALHOS</div>
            <div class="ph-shortcut-grid" id="ph-shortcut-grid"></div>
            <p class="ph-shortcut-error" id="ph-shortcut-error"></p>
            <p class="ph-hint">Os atalhos valem com o mouse/foco sobre o painel. Clique numa tecla e pressione a nova combinação (ESC cancela; ESC só volta a uma ação via restaurar padrões). Combinações do navegador (Ctrl+W, Ctrl+T…) podem não funcionar.</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-shortcut-reset">Restaurar atalhos padrão</button>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-set-shortcut">Configurar atalho do navegador</button>
            <p class="ph-hint">Abre a página de atalhos do Chrome, onde dá pra definir a combinação que abre e fecha a extensão.</p>
        `;

        panel.querySelector('#ph-set-shortcut').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'pkmn-helper-open-shortcuts' });
        });

        const SHORTCUT_ACTIONS = [
            ['battle', 'Encontro atual'],
            ['calc', 'Calculadora de tipos'],
            ['myPokemons', 'Meus Pokémon'],
            ['settings', 'Configurações'],
            ['typeChart', 'Tabela de tipos (expande o painel)'],
            ['toggleFull', 'Expandir / recolher'],
            ['minimize', 'Minimizar / voltar']
        ];
        const shortcutGrid = panel.querySelector('#ph-shortcut-grid');
        const shortcutError = panel.querySelector('#ph-shortcut-error');
        const fmt = PokemonHelperShortcutUtils.formatCombo;

        function renderShortcutGrid(shortcuts) {
            shortcutGrid.innerHTML = SHORTCUT_ACTIONS.map(([action, label]) =>
                `<button type="button" class="ph-key ph-key-btn" data-action="${action}">${fmt(shortcuts[action])}</button>` +
                `<span class="ph-key-desc">${label}</span>`
            ).join('');
        }
        PokemonHelperStorage.getUiPreferences().then((prefs) => renderShortcutGrid(prefs.shortcuts)).catch(() => {});

        let capturing = null; // { action, btn }
        function stopCapture() {
            if (!capturing) return;
            capturing.btn.classList.remove('capturing');
            PokemonHelperStorage.getUiPreferences()
                .then((prefs) => { capturing = null; renderShortcutGrid(prefs.shortcuts); })
                .catch(() => { capturing = null; });
            document.removeEventListener('keydown', onCaptureKey, true);
        }

        function onCaptureKey(event) {
            if (!capturing) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.key === 'Escape') { shortcutError.textContent = ''; stopCapture(); return; }
            const combo = PokemonHelperShortcutUtils.comboFromEvent(event);
            if (!combo) return; // modificador sozinho: continua capturando
            const action = capturing.action;
            PokemonHelperStorage.getUiPreferences().then((prefs) => {
                const inUse = Object.keys(prefs.shortcuts)
                    .find((name) => name !== action && prefs.shortcuts[name] === combo);
                if (inUse) {
                    const label = SHORTCUT_ACTIONS.find(([name]) => name === inUse)[1];
                    shortcutError.textContent = `${fmt(combo)} JÁ É USADO POR: ${label.toUpperCase()}`;
                    return; // segue capturando pra tentar outra
                }
                shortcutError.textContent = '';
                return PokemonHelperStorage.setUiPreferences({ shortcuts: { [action]: combo } })
                    .then(() => stopCapture());
            }).catch((error) => {
                console.warn('[Pokemon Helper] Não foi possível salvar o atalho:', error);
                stopCapture();
            });
        }

        shortcutGrid.addEventListener('click', (event) => {
            const btn = event.target.closest('.ph-key-btn');
            if (!btn) return;
            if (capturing) stopCapture();
            capturing = { action: btn.dataset.action, btn };
            btn.classList.add('capturing');
            btn.textContent = '...';
            shortcutError.textContent = '';
            document.addEventListener('keydown', onCaptureKey, true);
        });
        // clicar em qualquer lugar fora do botão em captura cancela
        panel.addEventListener('click', (event) => {
            if (capturing && !event.target.closest('.ph-key-btn')) stopCapture();
        });

        panel.querySelector('#ph-shortcut-reset').addEventListener('click', () => {
            shortcutError.textContent = '';
            PokemonHelperStorage.setUiPreferences({
                shortcuts: Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES.shortcuts)
            }).then(() => PokemonHelperStorage.getUiPreferences())
              .then((prefs) => renderShortcutGrid(prefs.shortcuts))
              .catch((error) => console.warn('[Pokemon Helper] Não foi possível restaurar os atalhos:', error));
        });

        const notificationsToggle = panel.querySelector('#ph-update-notifications');
        const betaToggle = panel.querySelector('#ph-beta-channel');
        const betaRow = panel.querySelector('#ph-beta-channel-row');

        function setToggleState(toggle, enabled) {
            toggle.setAttribute('aria-checked', String(enabled));
        }

        // botão que cicla entre opções [{value, label}] e persiste via save(value)
        function bindCycle(id, options, current, save) {
            const btn = panel.querySelector(`#${id}`);
            let index = Math.max(0, options.findIndex((option) => option.value === current));
            const paint = () => { btn.textContent = options[index].label; };
            paint();
            btn.addEventListener('click', () => {
                const previousIndex = index;
                index = (index + 1) % options.length;
                paint();
                save(options[index].value).catch((error) => {
                    index = previousIndex;
                    paint();
                    console.warn('[Pokemon Helper] Não foi possível salvar a preferência:', error);
                });
            });
        }

        function bindPrefToggle(id, current, save) {
            const toggle = panel.querySelector(`#${id}`);
            setToggleState(toggle, current);
            toggle.addEventListener('click', () => {
                const enabled = toggle.getAttribute('aria-checked') !== 'true';
                setToggleState(toggle, enabled);
                save(enabled).catch((error) => {
                    setToggleState(toggle, !enabled);
                    console.warn('[Pokemon Helper] Não foi possível salvar a preferência:', error);
                });
            });
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

        const widthValue = panel.querySelector('#ph-width-value');
        function applyWidth(delta) {
            const container = shell.getContainer();
            // usa o MESMO objeto que arrastar/redimensionar/maximizar mutam
            // (container.__phSettings), nunca uma cópia via currentSettings() —
            // senão a próxima ação nesses outros caminhos reverte e persiste
            // por cima da edição feita aqui.
            const settings = container && container.__phSettings;
            if (!container || !settings) return;
            if (settings.maximized) {
                settings.restoreWidth = shell.clampNum(shell.dockedWidth(settings) + delta, 250, 380, shell.dockedWidth(settings));
                container.dataset.restoreWidth = String(settings.restoreWidth);
                shell.syncFullSide(container, settings); // atualiza --ph-side-width já, pro caso o modo lado a lado esteja ativo
            } else {
                settings.width = shell.clampNum(settings.width + delta, 250, 380, settings.width);
                shell.applyBox(container, settings);
            }
            widthValue.textContent = `${shell.dockedWidth(settings)}px`;
            shell.updateStatus(container, settings);
            shell.persist(shell.currentSettings(container));
        }
        panel.querySelector('#ph-width-minus').addEventListener('click', () => applyWidth(-20));
        panel.querySelector('#ph-width-plus').addEventListener('click', () => applyWidth(20));
        widthValue.textContent = '—';
        setTimeout(() => { // preenche após o container existir
            const container = shell.getContainer();
            const settings = container && container.__phSettings;
            if (settings) widthValue.textContent = `${shell.dockedWidth(settings)}px`;
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

        PokemonHelperStorage.getUiPreferences().then((prefs) => {
            bindCycle('ph-start-view', [
                { value: 'last', label: 'ÚLTIMA USADA' },
                { value: 'battle', label: 'ENCONTRO' },
                { value: 'calc', label: 'CALCULADORA' },
                { value: 'myPokemons', label: 'MEUS POKÉMON' }
            ], prefs.startView, (startView) => PokemonHelperStorage.setUiPreferences({ startView }));

            bindCycle('ph-start-collapsed', [
                { value: 'remember', label: 'LEMBRAR' },
                { value: 'collapsed', label: 'MINIMIZADO' },
                { value: 'open', label: 'ABERTO' }
            ], prefs.startCollapsed, (startCollapsed) => PokemonHelperStorage.setUiPreferences({ startCollapsed }));

            bindPrefToggle('ph-auto-battle', prefs.autoSwitchToBattle,
                (autoSwitchToBattle) => PokemonHelperStorage.setUiPreferences({ autoSwitchToBattle }));

            bindPrefToggle('ph-mp-groups', prefs.screens.myPokemons.expandGroupsByDefault,
                (v) => PokemonHelperStorage.setUiPreferences({ screens: { myPokemons: { expandGroupsByDefault: v } } }));
            bindPrefToggle('ph-mp-pokemon', prefs.screens.myPokemons.expandPokemonByDefault,
                (v) => PokemonHelperStorage.setUiPreferences({ screens: { myPokemons: { expandPokemonByDefault: v } } }));

            const battleToggles = [
                ['ph-bt-stats', 'showIvs'], ['ph-bt-weak', 'showWeaknesses'],
                ['ph-bt-moves', 'showFoeMoves'], ['ph-bt-balls', 'showPokeballs'],
                ['ph-bt-stages', 'showStatChanges'], ['ph-bt-mymoves', 'showMyMoves']
            ];
            battleToggles.forEach(([id, field]) => {
                bindPrefToggle(id, prefs.screens.battle[field],
                    (v) => PokemonHelperStorage.setUiPreferences({ screens: { battle: { [field]: v } } }));
            });
        }).catch((error) => console.warn('[Pokemon Helper] Não foi possível carregar preferências:', error));

        return panel;
}
