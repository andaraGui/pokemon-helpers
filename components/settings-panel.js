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
            <div class="ph-set-head">ATALHOS</div>
            <div class="ph-shortcut-grid">
                ${[['E', 'Encontro atual'], ['C', 'Calculadora de tipos'], ['M', 'Meus Pokémon'], [',', 'Configurações'],
                   ['T', 'Tabela de tipos (expande o painel)'], ['F', 'Expandir / recolher'], ['ESC', 'Minimizar / voltar']]
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

        return panel;
}
