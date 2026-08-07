# Configurações Editáveis — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atalhos de teclado remapeáveis (com modificadores), tela de Configurações reestruturada em seções (Painel / Comportamento / Atalhos / Telas / Atualizações / Dados), novas opções de comportamento e configs por tela, com import/export e restaurar padrões.

**Architecture:** Mapa único de atalhos no shell (content.js) alimentado por `chrome.storage.local`; iframes repassam todo keydown "burro" via postMessage; cada tela lê suas preferências direto do storage e re-renderiza via `chrome.storage.onChanged`. Spec aprovado: `docs/superpowers/specs/2026-08-07-configuracoes-editaveis-design.md`.

**Tech Stack:** JS puro de extensão MV3 (sem build, sem npm, sem framework de teste). Chrome + Firefox.

## Global Constraints

- **Sem suite de testes** (AGENTS.md): cada task termina com verificação manual carregando a extensão unpacked (`chrome://extensions` → Load unpacked na raiz do repo) e recarregando `infinitymmo.net`. O ciclo TDD é substituído por "implementar → verificar manualmente → commitar".
- Comentários/commits em **português**; identificadores em inglês. Estilo do arquivo vizinho.
- **NÃO bumpar a versão** do manifest (só em release).
- `components/` é copiado inteiro pelos build scripts (`cp -r`) e `components/*.js` já está em `web_accessible_resources` dos dois manifests → arquivos novos em `components/` **não** exigem mudança em manifest nem em `FILES` dos build scripts. A única lista a atualizar é a injeção do content world em `background.js` (linha ~222).
- Não tocar em `interceptor.js` nem no duck-typing de payloads (`data.foe`/`data.party`/`data.pc`).
- Nomes de ação de atalho são estáveis: `battle`, `calc`, `myPokemons`, `settings`, `typeChart`, `toggleFull`, `minimize`.
- Formato de combinação: string normalizada, modificadores na ordem fixa `ctrl`, `alt`, `shift`, `meta` + tecla minúscula (`event.key`), separados por `+`. Ex.: `"t"`, `"ctrl+shift+e"`, `"escape"`, `","`.
- O estado vivo do painel é `container.__phSettings` (mesmo objeto que arrastar/redimensionar mutam) — nunca editar uma cópia de `currentSettings()`.
- Estado que precisa sobreviver à re-injeção do content.js (toggle da extensão) vive em `window.__pkmnHelper*`, não em variável de closure (os listeners guardados por flag `window.__pkmnHelper*Added` são registrados uma única vez e não enxergam closures de IIFEs futuras).

---

### Task 1: Camada de storage — novos defaults e merge profundo

**Files:**
- Modify: `data/extension-storage.js` (DEFAULT_UI_PREFERENCES linhas 44-46, getters/setters linhas 91-92)

**Interfaces:**
- Consumes: nada novo.
- Produces (usado por TODAS as tasks seguintes):
  - `PokemonHelperStorage.DEFAULT_UI_PREFERENCES` — objeto congelado com o shape completo abaixo.
  - `PokemonHelperStorage.getUiPreferences(): Promise<prefs>` — sempre retorna o shape completo (merge profundo de `shortcuts` e `screens` com os defaults).
  - `PokemonHelperStorage.setUiPreferences(changes): Promise` — aceita mudanças parciais; `changes.shortcuts` e `changes.screens.<tela>` são mesclados campo a campo sobre o valor atual (nunca apagam chaves não mencionadas).

- [ ] **Step 1: Expandir `DEFAULT_UI_PREFERENCES`**

Substituir o bloco atual (linhas 44-46) por:

```js
    const DEFAULT_UI_PREFERENCES = Object.freeze({
        tooltipsEnabled: true,
        startView: 'last',            // 'last' | 'battle' | 'calc' | 'myPokemons'
        startCollapsed: 'remember',   // 'remember' | 'collapsed' | 'open'
        autoSwitchToBattle: true,
        // ação → combinação normalizada (ver PokemonHelperShortcutUtils)
        shortcuts: Object.freeze({
            battle: 'e',
            calc: 'c',
            myPokemons: 'm',
            settings: ',',
            typeChart: 't',
            toggleFull: 'f',
            minimize: 'escape'
        }),
        screens: Object.freeze({
            myPokemons: Object.freeze({
                expandPokemonByDefault: false,
                expandGroupsByDefault: true
            }),
            battle: Object.freeze({
                showStatChanges: true,
                showWeaknesses: true,
                showFoeMoves: true,
                showPokeballs: true,
                showIvs: true,
                showMyMoves: true
            })
        })
    });
```

- [ ] **Step 2: Merge profundo na leitura e escrita**

Adicionar após a função `update()` (linha ~77):

```js
    // uiPreferences tem objetos aninhados (shortcuts, screens) — o merge raso
    // de read() substituiria o objeto inteiro pelo salvo, e uma versão futura
    // que adicionasse uma ação/tela nova deixaria configs antigas sem o campo.
    function mergeUiPreferences(stored) {
        const prefs = Object.assign({}, DEFAULT_UI_PREFERENCES, stored);
        prefs.shortcuts = Object.assign({}, DEFAULT_UI_PREFERENCES.shortcuts, stored && stored.shortcuts);
        prefs.screens = {};
        Object.keys(DEFAULT_UI_PREFERENCES.screens).forEach((screen) => {
            prefs.screens[screen] = Object.assign({},
                DEFAULT_UI_PREFERENCES.screens[screen],
                stored && stored.screens && stored.screens[screen]);
        });
        return prefs;
    }

    function getUiPreferencesDeep() {
        return read(KEYS.uiPreferences, {}).then(mergeUiPreferences);
    }

    async function updateUiPreferences(changes) {
        const current = await getUiPreferencesDeep();
        const next = Object.assign({}, current, changes);
        if (changes.shortcuts) next.shortcuts = Object.assign({}, current.shortcuts, changes.shortcuts);
        if (changes.screens) {
            next.screens = {};
            Object.keys(current.screens).forEach((screen) => {
                next.screens[screen] = Object.assign({}, current.screens[screen], changes.screens[screen]);
            });
        }
        return write(KEYS.uiPreferences, next);
    }
```

E trocar as duas linhas do objeto exportado:

```js
        getUiPreferences: getUiPreferencesDeep,
        setUiPreferences: updateUiPreferences,
```

- [ ] **Step 3: Verificar manualmente**

Recarregar a extensão unpacked, abrir o DevTools de qualquer iframe do painel (ver seção "DevTools" do README — o site bloqueia F12 normal) e rodar no console:

```js
await PokemonHelperStorage.setUiPreferences({ shortcuts: { battle: 'b' } });
await PokemonHelperStorage.getUiPreferences();
// Esperado: shortcuts.battle === 'b' e TODAS as outras ações/telas presentes
// com os defaults; tooltipsEnabled preservado.
await PokemonHelperStorage.setUiPreferences({ shortcuts: { battle: 'e' } }); // desfaz
```

- [ ] **Step 4: Commit**

```bash
git add data/extension-storage.js
git commit -m "feat: uiPreferences ganha atalhos, comportamento e configs por tela com merge profundo"
```

---

### Task 2: Utilitários de combinação + repassador compartilhado nos iframes

**Files:**
- Create: `components/shortcut-utils.js`
- Create: `components/shortcut-forwarder.js`
- Modify: `index.html:52-58`, `battle.html:101-115`, `chart.html:171-177`, `myPokemons.html:104-114` (adicionar script)
- Modify: `app.js:234-241`, `chart.js:103-110`, `myPokemons.js:612-619` (remover repassadores duplicados)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `PokemonHelperShortcutUtils.comboFromEvent(evtLike): string|null` — `evtLike` é um KeyboardEvent OU o objeto serializado `{key, ctrl, alt, shift, meta}`; retorna a string normalizada ou `null` se for só modificador.
  - `PokemonHelperShortcutUtils.splitCombo(combo): {mods: string[], key: string}`.
  - `PokemonHelperShortcutUtils.formatCombo(combo): string` — rótulo de exibição (`"Ctrl+Shift+E"`, `"ESC"`, `","`).
  - Mensagem `panel-shortcut` passa a carregar `{type, key, ctrl, alt, shift, meta}` (o `handleShortcut` atual só lê `data.key` — segue funcionando até a Task 3).

- [ ] **Step 1: Criar `components/shortcut-utils.js`**

```js
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
```

- [ ] **Step 2: Criar `components/shortcut-forwarder.js`**

```js
// ---------------------------------------------------------------------------
// Repassador de atalhos dos iframes do painel: envia TODO keydown fora de
// campo de texto pro shell (content.js), que é quem conhece o mapa de
// atalhos configurado. Substitui as listas de teclas que viviam duplicadas
// em app.js/chart.js/myPokemons.js (e faltavam em battle.js).
// ---------------------------------------------------------------------------
(() => {
    // só faz sentido dentro de um iframe do painel — nunca na página do jogo
    if (window.parent === window) return;
    window.addEventListener('keydown', (event) => {
        if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        window.parent.postMessage({
            type: 'panel-shortcut',
            key: event.key,
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey
        }, '*');
    });
})();
```

- [ ] **Step 3: Incluir nos 4 HTMLs e remover os repassadores antigos**

Em `index.html`, `battle.html`, `chart.html` e `myPokemons.html`, adicionar **antes do script principal da página** (ex.: antes de `<script src="app.js">`):

```html
    <script src="components/shortcut-forwarder.js"></script>
```

Remover os blocos duplicados (o comentário e o `window.addEventListener('keydown', ...)` que posta `panel-shortcut`):
- `app.js` linhas 234-241;
- `chart.js` linhas 103-110 (manter o handler de `panel-exit-full` que fica logo acima);
- `myPokemons.js` linhas 612-619.

- [ ] **Step 4: Verificar manualmente**

Recarregar extensão + página. Com o mouse sobre CADA uma das 4 telas (Calculadora, Encontro, Meus Pokémon, Tabela em modo full): E/C/M/T/F/ESC/vírgula continuam funcionando como hoje (o `handleShortcut` antigo lê `data.key`). Digitar em um campo de busca de Meus Pokémon NÃO troca de aba.

- [ ] **Step 5: Commit**

```bash
git add components/shortcut-utils.js components/shortcut-forwarder.js index.html battle.html chart.html myPokemons.html app.js chart.js myPokemons.js
git commit -m "feat: repassador de atalhos compartilhado nos iframes (inclui tela de encontro) e utilitários de combinação"
```

---

### Task 3: content.js — mapa de atalhos configurável e rótulos dinâmicos

**Files:**
- Modify: `content.js` (init 40-50, header 76-81, `SHORTCUT_VIEWS`/`handleShortcut` 288-322, listener de message 330-339, `updateStatus` 714-719)
- Modify: `background.js:222` (adicionar `components/shortcut-utils.js` à lista injetada, antes de `content.js`)

**Interfaces:**
- Consumes: `PokemonHelperShortcutUtils` (Task 2), `PokemonHelperStorage.getUiPreferences()` (Task 1).
- Produces (usado pelas Tasks 4-7):
  - `window.__pkmnHelperUiPrefs` — prefs vivas, atualizadas por `chrome.storage.onChanged` (vive em `window` porque os listeners guardados por flag sobrevivem à re-injeção do IIFE).
  - `performAction(action: string)` — executa uma ação de atalho pelo nome.
  - `refreshShortcutLabels(container)` — reaplica tooltips do cabeçalho + barra de status a partir das prefs.

- [ ] **Step 1: Injetar utilitários no content world**

Em `background.js` linha 222, a lista vira:

```js
files: ['data/extension-storage.js', 'components/pixel-icon.js', 'components/tooltip.js', 'components/header-buttons.js', 'components/shortcut-utils.js', 'content.js']
```

- [ ] **Step 2: Carregar prefs junto com o overlay e ouvir mudanças**

Substituir o encadeamento inicial (linhas 40-50) por:

```js
    Promise.all([
        PokemonHelperStorage.getOverlaySettings(),
        PokemonHelperStorage.getUiPreferences()
    ]).then(([storedSettings, prefs]) => {
        if (mode === 'ensure') window.__pkmnHelperEnsurePending = false;
        window.__pkmnHelperUiPrefs = prefs;
        const settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings);
        if (mode === 'ensure' && settings.open === false) return;
        settings.open = true;
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
```

- [ ] **Step 3: handleShortcut por combinação → ação**

Substituir o bloco `SHORTCUT_VIEWS`/`handleShortcut` (linhas 288-316) por:

```js
        // a tabela 18×18 só aparece no modo expandido, ao lado das views de
        // conteúdo (syncFullSide) — estas são as views que a exibem
        const CHART_HOST_VIEWS = ['calc', 'battle'];
        const VIEW_ACTIONS = { battle: 'battle', calc: 'calc', myPokemons: 'myPokemons', settings: 'settings' };

        function performAction(action) {
            const container = document.getElementById(ID);
            if (!container || container.classList.contains('collapsed')) return;
            const settings = currentSettings(container);
            if (VIEW_ACTIONS[action]) {
                delete container.dataset.preBattleView;
                setActiveView(VIEW_ACTIONS[action], container);
            } else if (action === 'toggleFull') {
                container.querySelector('.ph-maximize-btn')?.click();
            } else if (action === 'typeChart') {
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
            } else if (action === 'minimize') {
                if (settings.maximized) container.querySelector('.ph-maximize-btn')?.click();
                else setCollapsed(container, settings, true);
            }
        }

        // evtLike: KeyboardEvent ou o objeto serializado do shortcut-forwarder
        function handleShortcut(evtLike) {
            const combo = PokemonHelperShortcutUtils.comboFromEvent(evtLike);
            if (!combo) return;
            const shortcuts = uiPrefs().shortcuts;
            const action = Object.keys(shortcuts).find((name) => shortcuts[name] === combo);
            if (action) performAction(action);
        }
```

Atualizar o listener do container (linhas 319-322) para repassar o evento inteiro:

```js
        container.addEventListener('keydown', (event) => {
            if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
            handleShortcut(event);
        });
```

E no listener de `message` (linha 333), trocar
`handleShortcut(String(data.key).toLowerCase())` por `handleShortcut(data)`.

- [ ] **Step 4: Rótulos dinâmicos (tooltips do cabeçalho + barra de status)**

No `build()`, trocar o array fixo de `buildHeaderButtons` (linhas 76-81) por:

```js
        const fmt = PokemonHelperShortcutUtils.formatCombo;
        const shortcuts = uiPrefs().shortcuts;
        const { collapseBtn, maximizeBtn } = buildHeaderButtons(header, [
            { icon: 'enc', tip: `Encontro atual — tecla ${fmt(shortcuts.battle)}`, view: 'battle' },
            { icon: 'calc', tip: `Calculadora de tipos — tecla ${fmt(shortcuts.calc)}`, view: 'calc' },
            { icon: 'team', tip: `Meus Pokémon — tecla ${fmt(shortcuts.myPokemons)}`, view: 'myPokemons' },
            { icon: 'cfg', tip: `Configurações — tecla ${fmt(shortcuts.settings)}`, view: 'settings' },
        ], { tip: `Minimizar — ${fmt(shortcuts.minimize)}` }, { tip: `Expandir — ${fmt(shortcuts.toggleFull)}` });
```

Adicionar no escopo do módulo (junto de `updateStatus`):

```js
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
```

E em `updateStatus` (linha 718), trocar o texto fixo por:

```js
        const fmt = PokemonHelperShortcutUtils.formatCombo;
        const shortcuts = uiPrefs().shortcuts;
        text.textContent = `${dataSeen ? 'CONECTADO' : 'AGUARDANDO DADOS'} · ${mode} · ${fmt(shortcuts.toggleFull)}=EXPANDIR  ${fmt(shortcuts.minimize)}=MINIMIZAR`;
```

- [ ] **Step 5: Verificar manualmente**

Todos os atalhos default seguem funcionando (foco no shell E nos 4 iframes). No console de um iframe:
`await PokemonHelperStorage.setUiPreferences({ shortcuts: { calc: 'ctrl+shift+c' } })` →
sem recarregar, C deixa de trocar pra Calculadora, Ctrl+Shift+C troca, e a barra de status/tooltips continuam coerentes. Desfazer com `{ shortcuts: { calc: 'c' } }`.

- [ ] **Step 6: Commit**

```bash
git add content.js background.js
git commit -m "feat: atalhos do painel viram mapa configurável no storage com rótulos dinâmicos"
```

---

### Task 4: Comportamento — view inicial, estado ao abrir e auto-troca

**Files:**
- Modify: `content.js` (encadeamento inicial da Task 3; `handleHelperPayload` linhas 396-408)

**Interfaces:**
- Consumes: `window.__pkmnHelperUiPrefs` / `uiPrefs()` (Task 3); campos `startView`, `startCollapsed`, `autoSwitchToBattle` (Task 1).
- Produces: nada novo (comportamento).

- [ ] **Step 1: Aplicar `startView`/`startCollapsed` na construção**

No `.then()` inicial (Task 3, Step 2), logo antes de `build(settings)`:

```js
        // preferências de abertura: 'last'/'remember' preservam o comportamento
        // atual (usa o que está persistido em overlaySettings)
        if (prefs.startView !== 'last') settings.view = prefs.startView;
        if (prefs.startCollapsed !== 'remember') settings.collapsed = prefs.startCollapsed === 'collapsed';
```

- [ ] **Step 2: Gate da auto-troca pra batalha**

Em `handleHelperPayload`, no início do bloco `if (isBattlePayload) {` (linha 396), depois do clear do timer:

```js
                if (isBattlePayload) {
                    if (battleReturnTimer) {
                        clearTimeout(battleReturnTimer);
                        battleReturnTimer = null;
                    }
                    // usuário pode desligar a troca automática pra aba Encontro;
                    // sem preBattleView setado, o retorno automático também não roda
                    if (uiPrefs().autoSwitchToBattle === false) return;
                    ...resto igual...
```

A auto-troca pra Meus Pokémon (payload de personagem) fica como está — fora do escopo.

- [ ] **Step 3: Verificar manualmente**

No console: `await PokemonHelperStorage.setUiPreferences({ startView: 'myPokemons', startCollapsed: 'open' })` → F5 na página → painel abre aberto na aba Meus Pokémon. `{ autoSwitchToBattle: false }` → entrar em batalha selvagem → painel NÃO troca de aba (dados da batalha seguem chegando na aba Encontro se navegar manualmente). Restaurar: `{ startView: 'last', startCollapsed: 'remember', autoSwitchToBattle: true }`.

- [ ] **Step 4: Commit**

```bash
git add content.js
git commit -m "feat: view inicial, estado ao abrir e auto-troca pro encontro viram preferências"
```

---

### Task 5: Extrair o painel de Configurações pra componente próprio

**Files:**
- Create: `components/settings-panel.js`
- Modify: `content.js` (remover `buildSettingsPanel` linhas 567-688; chamada na linha 107)
- Modify: `background.js:222` (adicionar `components/settings-panel.js` antes de `content.js`)

**Interfaces:**
- Consumes: helpers do content.js via objeto `shell` (abaixo).
- Produces (usado pelas Tasks 6, 7 e 10):
  - Global `buildSettingsPanel(shell): HTMLElement` definida em `components/settings-panel.js` (mesmo padrão bare-global de `buildHeaderButtons`).
  - Contrato de `shell` (todas funções já existentes no content.js):
    ```js
    {
      getContainer(): HTMLElement|null,     // () => document.getElementById(ID)
      dockedWidth(settings): number,
      clampNum(v, min, max, fallback): number,
      applyBox(container, settings): void,
      syncFullSide(container, settings): void,
      updateStatus(container, settings): void,
      persist(settings): void,
      currentSettings(container): object,
      uiPrefs(): object                     // prefs vivas (Task 3)
    }
    ```

- [ ] **Step 1: Mover a função**

Criar `components/settings-panel.js` com o cabeçalho de comentário padrão dos componentes e o corpo ATUAL de `buildSettingsPanel` (linhas 567-688 do content.js) movido **verbatim**, com só estas trocas mecânicas:

- assinatura: `function buildSettingsPanel(shell) {`
- `document.getElementById(ID)` → `shell.getContainer()` (2 ocorrências: `applyWidth` e o `setTimeout` da largura)
- `dockedWidth(` → `shell.dockedWidth(`, `clampNum(` → `shell.clampNum(`, `applyBox(` → `shell.applyBox(`, `syncFullSide(` → `shell.syncFullSide(`, `updateStatus(` → `shell.updateStatus(`, `persist(` → `shell.persist(`, `currentSettings(` → `shell.currentSettings(`

No content.js, apagar a função e trocar a linha 107 por:

```js
        const settingsPanel = buildSettingsPanel({
            getContainer: () => document.getElementById(ID),
            dockedWidth, clampNum, applyBox, syncFullSide,
            updateStatus, persist, currentSettings, uiPrefs
        });
```

Em `background.js`, a lista de injeção vira:

```js
files: ['data/extension-storage.js', 'components/pixel-icon.js', 'components/tooltip.js', 'components/header-buttons.js', 'components/shortcut-utils.js', 'components/settings-panel.js', 'content.js']
```

- [ ] **Step 2: Verificar manualmente**

Aba Configurações: largura +/- funciona (encaixado E expandido), toggles de tooltips/atualizações/beta funcionam, botão "Configurar atalho do navegador" abre a página do Chrome. Nenhuma regressão visual.

- [ ] **Step 3: Commit**

```bash
git add components/settings-panel.js content.js background.js
git commit -m "refactor: painel de configurações extraído pra components/settings-panel.js"
```

---

### Task 6: Seções COMPORTAMENTO e TELAS na tela de Configurações

**Files:**
- Modify: `components/settings-panel.js` (HTML do painel + bindings)
- Modify: `content.js` (`injectStyle`: CSS novo)

**Interfaces:**
- Consumes: `PokemonHelperStorage.get/setUiPreferences` (Task 1); vive dentro de `buildSettingsPanel` (Task 5).
- Produces: helpers locais `bindCycle(id, options, current, save)` e `bindPrefToggle(id, current, save)` no escopo de `buildSettingsPanel`.

- [ ] **Step 1: CSS dos widgets novos**

Em `injectStyle()` do content.js, junto das regras `.ph-toggle`:

```css
            #${ID} .ph-cycle { min-width: 116px; height: 24px; padding: 0 8px; background: #16161f; border: 1px solid #2b2b39; color: #ffb545; font-family: 'Silkscreen', monospace; font-size: 10px; cursor: pointer; }
            #${ID} .ph-subhead { font-family: 'Silkscreen', monospace; font-size: 9px; color: #63637a; letter-spacing: 1px; margin: 8px 0 6px; }
```

- [ ] **Step 2: HTML das seções**

No template do painel (`panel.innerHTML`), depois da linha do toggle de tooltips e ANTES de `<div class="ph-set-head">ATALHOS</div>`, inserir:

```html
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
```

- [ ] **Step 3: Bindings genéricos**

Dentro de `buildSettingsPanel`, depois de `setToggleState`:

```js
        // botão que cicla entre opções [{value, label}] e persiste via save(value)
        function bindCycle(id, options, current, save) {
            const btn = panel.querySelector(`#${id}`);
            let index = Math.max(0, options.findIndex((option) => option.value === current));
            const paint = () => { btn.textContent = options[index].label; };
            paint();
            btn.addEventListener('click', () => {
                index = (index + 1) % options.length;
                paint();
                save(options[index].value).catch((error) => {
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
```

E os bindings (usando `PokemonHelperStorage.getUiPreferences()` pra estado inicial):

```js
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
```

Obs.: `ph-bt-stats` controla `showIvs` (a seção "IVS / STATS"); `ph-bt-stages` controla `showStatChanges` (a seção "atributos alterados"). Não confundir os dois.

- [ ] **Step 4: Verificar manualmente**

Todos os widgets refletem o storage (mudar via console → reabrir a aba Configurações mostra o valor novo). Ciclar view inicial → F5 → painel abre na aba escolhida. Os toggles de TELAS persistem (efeito real nas telas vem nas Tasks 8-9).

- [ ] **Step 5: Commit**

```bash
git add components/settings-panel.js content.js
git commit -m "feat: seções COMPORTAMENTO e TELAS na tela de configurações"
```

---

### Task 7: Seção ATALHOS — captura, duplicata e restaurar padrões

**Files:**
- Modify: `components/settings-panel.js` (substituir a grade estática de atalhos)
- Modify: `content.js` (`injectStyle`: CSS de captura)

**Interfaces:**
- Consumes: `PokemonHelperShortcutUtils` (Task 2), `PokemonHelperStorage` (Task 1). A atualização de rótulos do shell acontece sozinha via `chrome.storage.onChanged` (Task 3) — o painel NÃO chama `refreshShortcutLabels` diretamente.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: CSS**

Em `injectStyle()`:

```css
            #${ID} .ph-key-btn { cursor: pointer; min-width: 52px; }
            #${ID} .ph-key-btn.capturing { color: #0c0c11; background: #ffb545; border-color: #ffb545; }
            #${ID} .ph-shortcut-error { color: #e06c60; font-size: 12px; font-family: 'Silkscreen', monospace; min-height: 14px; margin: 0 0 8px; }
```

- [ ] **Step 2: Grade interativa**

Substituir no template a grade estática (o `.map()` de pares tecla/descrição, o `<p class="ph-hint">Os atalhos valem...</p>` fica) por:

```html
            <div class="ph-shortcut-grid" id="ph-shortcut-grid"></div>
            <p class="ph-shortcut-error" id="ph-shortcut-error"></p>
            <p class="ph-hint">Os atalhos valem com o mouse/foco sobre o painel. Clique numa tecla e pressione a nova combinação (ESC cancela; ESC só volta a uma ação via restaurar padrões). Combinações do navegador (Ctrl+W, Ctrl+T…) podem não funcionar.</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-shortcut-reset">Restaurar atalhos padrão</button>
```

E o código de montagem/captura (dentro de `buildSettingsPanel`):

```js
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
```

Detalhe importante: o listener `onCaptureKey` usa fase de captura em `document` (do content world, dentro da página do jogo) com `preventDefault` — a tecla capturada não vaza pro jogo nem dispara `handleShortcut` (o listener do container roda no bubbling).

- [ ] **Step 3: Verificar manualmente**

Na aba Configurações: clicar numa tecla → vira `...` destacado; pressionar `Ctrl+Shift+E` grava e o rótulo atualiza; o atalho novo funciona na hora e o antigo para; barra de status e tooltips do cabeçalho refletem a mudança (via onChanged). Tentar gravar uma combinação em uso → erro "JÁ É USADO POR ..." e captura continua. Ctrl sozinho não conclui. ESC cancela. Clicar fora cancela. "Restaurar atalhos padrão" volta tudo.

- [ ] **Step 4: Commit**

```bash
git add components/settings-panel.js content.js
git commit -m "feat: remapeamento de atalhos com captura, bloqueio de duplicata e restaurar padrões"
```

---

### Task 8: Meus Pokémon — expansão default configurável

**Files:**
- Modify: `myPokemons.js` (`UI_STATE` linha 20; `syncUiState` linhas 315-329; bootstrap no fim do arquivo)

**Interfaces:**
- Consumes: `prefs.screens.myPokemons` (Task 1).
- Produces: nada.

- [ ] **Step 1: Carregar prefs da tela**

No topo do arquivo (junto de `UI_STATE`):

```js
// defaults de expansão da tela (Configurações → TELAS). Começa com os
// defaults síncronos: se o primeiro payload chegar antes da leitura do
// storage resolver, o comportamento é o padrão — aceitável e raro.
let SCREEN_PREFS = Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES.screens.myPokemons);
PokemonHelperStorage.getUiPreferences()
    .then((prefs) => { SCREEN_PREFS = prefs.screens.myPokemons; })
    .catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
    PokemonHelperStorage.getUiPreferences()
        .then((prefs) => { SCREEN_PREFS = prefs.screens.myPokemons; })
        .catch(() => {});
});
```

- [ ] **Step 2: Aplicar em `syncUiState`**

Substituir o corpo (linhas 315-329) por:

```js
function syncUiState() {
    const groupKeys = DATA_STATE.groups.map((group) => group.key);
    const pokemonKeys = new Set(DATA_STATE.sourcePokemon.map((viewModel) => viewModel.key));
    groupKeys.forEach((key) => {
        // grupos novos (ou primeira carga) nascem expandidos só se a preferência mandar
        if ((!UI_STATE.initialized || !UI_STATE.knownGroups.has(key)) && SCREEN_PREFS.expandGroupsByDefault) {
            UI_STATE.expandedGroups.add(key);
        }
    });
    // pokémon: o default de expansão só vale na primeira carga da tela —
    // depois disso, quem manda é o toggle manual do usuário (expandedPokemon)
    if (!UI_STATE.initialized && SCREEN_PREFS.expandPokemonByDefault) {
        pokemonKeys.forEach((key) => UI_STATE.expandedPokemon.add(key));
    }
    UI_STATE.expandedGroups.forEach((key) => {
        if (!groupKeys.includes(key)) UI_STATE.expandedGroups.delete(key);
    });
    UI_STATE.expandedPokemon.forEach((key) => {
        if (!pokemonKeys.has(key)) UI_STATE.expandedPokemon.delete(key);
    });
    UI_STATE.knownGroups = new Set(groupKeys);
    UI_STATE.initialized = true;
}
```

- [ ] **Step 3: Verificar manualmente**

As 4 combinações dos 2 toggles (mudar em Configurações → F5 na página → abrir Meus Pokémon com dados): grupos/cards nascem conforme configurado. Toggles manuais continuam funcionando e não são atropelados por payloads seguintes. Modo full (`forceExpandAll`) intacto.

- [ ] **Step 4: Commit**

```bash
git add myPokemons.js
git commit -m "feat: expansão default de grupos e pokémon configurável em Meus Pokémon"
```

---

### Task 9: Batalha — seções ligáveis/desligáveis

**Files:**
- Modify: `battle.js` (topo do arquivo; `render()` linhas 446-452)

**Interfaces:**
- Consumes: `prefs.screens.battle` (Task 1).
- Produces: nada.

- [ ] **Step 1: Carregar prefs e re-renderizar em mudança**

No topo do battle.js (junto dos outros estados de módulo):

```js
// seções visíveis da tela (Configurações → TELAS → BATALHA)
let SCREEN_PREFS = Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES.screens.battle);
PokemonHelperStorage.getUiPreferences()
    .then((prefs) => { SCREEN_PREFS = prefs.screens.battle; render(); })
    .catch(() => {});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
    PokemonHelperStorage.getUiPreferences()
        .then((prefs) => { SCREEN_PREFS = prefs.screens.battle; render(); })
        .catch(() => {});
});
```

(`render()` já lida com `state.foe` ausente — mostra o empty state.)

- [ ] **Step 2: Gate das seções em `render()`**

Trocar as linhas 446-452 por:

```js
    let html = `<div class="enc-screen">` + head + meta + (SCREEN_PREFS.showIvs ? ivsSection : '');
    if (!state.caught) html += bestPlay(foe);
    if (SCREEN_PREFS.showWeaknesses) html += renderWeaknesses(foe);
    if (SCREEN_PREFS.showFoeMoves) html += renderFoeMoves(foe);
    if (SCREEN_PREFS.showPokeballs) html += renderBalls(foe);
    if (SCREEN_PREFS.showStatChanges) html += renderStages();
    if (state.caught) html += '<div class="gotcha"><span class="gotcha-badge">GOTCHA</span><p>Pokémon capturado</p></div>';
    else if (SCREEN_PREFS.showMyMoves && state.moves.length) html += `<div class="section"><div class="section-head"><span class="px-label">SEUS GOLPES</span></div><div class="rows">` +
        state.moves.map((move) => `<div class="row"><span class="label">${escapeHtml(move.name)}</span><span class="value">${move.pp} PP</span></div>`).join('') + '</div></div>';
```

O cabeçalho (sprite/HP/meta) e "melhor jogada" ficam sempre visíveis — não são seções configuráveis no spec.

- [ ] **Step 3: Verificar manualmente**

Em batalha real: desligar cada toggle de BATALHA nas Configurações → a seção some da tela **na hora** (sem F5, via onChanged). Religar → volta. Capturar o pokémon com seções desligadas → GOTCHA aparece normal.

- [ ] **Step 4: Commit**

```bash
git add battle.js
git commit -m "feat: seções da tela de encontro ligáveis/desligáveis pelas configurações"
```

---

### Task 10: Seção DADOS — exportar, importar e restaurar tudo

**Files:**
- Modify: `components/settings-panel.js` (nova seção no fim do template + lógica)
- Modify: `content.js` (`injectStyle`: CSS de feedback)

**Interfaces:**
- Consumes: `PokemonHelperStorage` (Task 1), `shell` (Task 5) pra aplicar aparência ao vivo.
- Produces: formato do arquivo exportado: `{ pokemonHelperConfig: 1, uiPreferences, updatePreferences, overlaySettings }`.

- [ ] **Step 1: CSS**

```css
            #${ID} .ph-data-feedback { font-family: 'Silkscreen', monospace; font-size: 10px; min-height: 13px; margin: 6px 0 0; }
            #${ID} .ph-data-feedback.ok { color: #63bb5b; }
            #${ID} .ph-data-feedback.err { color: #e06c60; }
```

- [ ] **Step 2: HTML (fim do template, depois da seção com o botão de atalho do navegador)**

```html
            <div class="ph-set-head">DADOS</div>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-export">Exportar configurações</button>
            <p class="ph-hint">Baixa um .json só com preferências (nada de pokédex ou golpes descobertos).</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-import">Importar configurações</button>
            <input type="file" id="ph-import-file" accept="application/json,.json" hidden>
            <p class="ph-hint">Substitui as configurações atuais pelas do arquivo.</p>
            <button type="button" class="ph-btn-shortcut px-btn" id="ph-reset-all">Restaurar tudo</button>
            <p class="ph-data-feedback" id="ph-data-feedback"></p>
```

- [ ] **Step 3: Lógica**

```js
        const dataFeedback = panel.querySelector('#ph-data-feedback');
        function showDataFeedback(message, ok) {
            dataFeedback.textContent = message;
            dataFeedback.className = `ph-data-feedback ${ok ? 'ok' : 'err'}`;
        }

        panel.querySelector('#ph-export').addEventListener('click', async () => {
            try {
                const [ui, updatePrefs, overlay] = await Promise.all([
                    PokemonHelperStorage.getUiPreferences(),
                    PokemonHelperStorage.getUpdatePreferences(),
                    PokemonHelperStorage.getOverlaySettings()
                ]);
                const payload = { pokemonHelperConfig: 1, uiPreferences: ui, updatePreferences: updatePrefs, overlaySettings: overlay };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'pokemon-helper-config.json';
                link.click();
                URL.revokeObjectURL(link.href);
                showDataFeedback('CONFIGURAÇÕES EXPORTADAS', true);
            } catch (error) {
                showDataFeedback('FALHA AO EXPORTAR', false);
                console.warn('[Pokemon Helper] Falha ao exportar configurações:', error);
            }
        });

        // copia recursivamente só os campos que existem nos defaults e têm o
        // mesmo tipo — qualquer chave desconhecida do arquivo é descartada
        function pickKnown(defaults, source) {
            if (!source || typeof source !== 'object') return null;
            const out = {};
            Object.keys(defaults).forEach((key) => {
                if (!(key in source)) return;
                const def = defaults[key];
                if (def !== null && typeof def === 'object') {
                    const nested = pickKnown(def, source[key]);
                    if (nested) out[key] = nested;
                } else if (source[key] === null || def === null || typeof source[key] === typeof def) {
                    out[key] = source[key];
                }
            });
            return out;
        }

        panel.querySelector('#ph-import').addEventListener('click', () => panel.querySelector('#ph-import-file').click());
        panel.querySelector('#ph-import-file').addEventListener('change', async (event) => {
            const file = event.target.files[0];
            event.target.value = '';
            if (!file) return;
            try {
                const parsed = JSON.parse(await file.text());
                if (!parsed || parsed.pokemonHelperConfig !== 1) throw new Error('formato desconhecido');
                const ui = pickKnown(PokemonHelperStorage.DEFAULT_UI_PREFERENCES, parsed.uiPreferences);
                const updatePrefs = pickKnown(PokemonHelperStorage.DEFAULT_UPDATE_PREFERENCES, parsed.updatePreferences);
                const overlay = pickKnown(PokemonHelperStorage.DEFAULT_OVERLAY_SETTINGS, parsed.overlaySettings);
                if (ui) await PokemonHelperStorage.setUiPreferences(ui);
                if (updatePrefs) await PokemonHelperStorage.setUpdatePreferences(updatePrefs);
                const container = shell.getContainer();
                if (overlay && container && container.__phSettings) {
                    // aplica a aparência importada no painel vivo (posição/tamanho),
                    // preservando aberto/visível da sessão atual
                    Object.assign(container.__phSettings, overlay, { open: true, collapsed: container.__phSettings.collapsed });
                    shell.applyBox(container, container.__phSettings);
                    shell.updateStatus(container, container.__phSettings);
                    shell.persist(shell.currentSettings(container));
                }
                const prefs = await PokemonHelperStorage.getUiPreferences();
                renderShortcutGrid(prefs.shortcuts);
                showDataFeedback('CONFIGURAÇÕES IMPORTADAS', true);
            } catch (error) {
                showDataFeedback('ARQUIVO INVÁLIDO — NADA FOI APLICADO', false);
                console.warn('[Pokemon Helper] Falha ao importar configurações:', error);
            }
        });

        panel.querySelector('#ph-reset-all').addEventListener('click', async () => {
            if (!window.confirm('Restaurar TODAS as configurações do Pokemon Helper para o padrão?')) return;
            try {
                await PokemonHelperStorage.setUiPreferences(Object.assign({}, PokemonHelperStorage.DEFAULT_UI_PREFERENCES));
                await PokemonHelperStorage.setUpdatePreferences(Object.assign({}, PokemonHelperStorage.DEFAULT_UPDATE_PREFERENCES));
                const container = shell.getContainer();
                if (container && container.__phSettings) {
                    const defaults = PokemonHelperStorage.DEFAULT_OVERLAY_SETTINGS;
                    Object.assign(container.__phSettings, {
                        top: defaults.top, right: defaults.right, width: defaults.width, height: defaults.height,
                        maximized: false, restoreWidth: null, restoreRight: null, restoreTop: null, restoreHeight: null
                    });
                    container.dataset.maximized = 'false';
                    shell.applyBox(container, container.__phSettings);
                    shell.syncFullSide(container, container.__phSettings);
                    shell.updateStatus(container, container.__phSettings);
                    shell.persist(shell.currentSettings(container));
                }
                const prefs = await PokemonHelperStorage.getUiPreferences();
                renderShortcutGrid(prefs.shortcuts);
                showDataFeedback('TUDO RESTAURADO PARA O PADRÃO', true);
            } catch (error) {
                showDataFeedback('FALHA AO RESTAURAR', false);
                console.warn('[Pokemon Helper] Falha ao restaurar configurações:', error);
            }
        });
```

Obs.: `renderShortcutGrid` é o da Task 7 (mesmo escopo de `buildSettingsPanel`). Os demais widgets (toggles/cycles) não são re-sincronizados ao vivo após import/restaurar — MVP aceito: ao reabrir a aba Configurações eles releem o storage. Import de `uiPreferences` parcial é aceito (merge da Task 1 completa o resto).

- [ ] **Step 4: Verificar manualmente**

Exportar → baixa o .json com as 3 chaves e sem caches. Mudar atalhos/toggles → importar o arquivo antigo → tudo volta (atalhos, comportamento, telas, largura/posição) e a grade de atalhos re-renderiza. Importar um .txt/JSON quebrado/JSON sem `pokemonHelperConfig` → "ARQUIVO INVÁLIDO", nada muda. Restaurar tudo → confirm → defaults aplicados, painel volta ao tamanho/posição padrão.

- [ ] **Step 5: Commit**

```bash
git add components/settings-panel.js content.js
git commit -m "feat: exportar/importar configurações e restaurar tudo na seção DADOS"
```

---

### Task 11: Verificação final, builds e documentação

**Files:**
- Modify: `README.md` (seção que documenta atalhos/configurações — localizar com `grep -n "talho" README.md`)

**Interfaces:**
- Consumes: tudo acima.
- Produces: release-ready.

- [ ] **Step 1: Checklist completo do spec (seção 5)**

Com a extensão unpacked no Chrome, percorrer TODOS os itens da seção
"Verificação" do spec (`docs/superpowers/specs/2026-08-07-configuracoes-editaveis-design.md`):
remap das 7 ações (tecla única e com modificador), atalhos nos 4 iframes + shell,
duplicata/ESC/modificador-sozinho na captura, restaurar padrões e restaurar tudo,
export→import round-trip + arquivo inválido, toggles de batalha ao vivo,
auto-troca desligada, expansão default (4 combinações), view inicial e estado
ao abrir (3 variações cada), e perfil limpo (remover e recarregar a extensão
→ comportamento idêntico ao atual).

- [ ] **Step 2: Builds e Firefox**

```bash
scripts/build-chrome.sh && scripts/build-firefox.sh
```

Esperado: ambos terminam com "Built:". Conferir que `dist/chrome/components/` contém `shortcut-utils.js`, `shortcut-forwarder.js` e `settings-panel.js` (o `cp -r` cobre — só confirmar). Carregar o build do Firefox temporariamente (`about:debugging`) e repetir um smoke test: remapear um atalho + um toggle de batalha.

- [ ] **Step 3: Atualizar README**

Na seção de atalhos/configurações do README (em português), documentar: atalhos remapeáveis na aba Configurações (captura, modificadores, duplicatas recusadas, ESC só volta via restaurar padrões), novas opções de comportamento, toggles por tela, export/import e restaurar. Manter o tom/estilo das seções vizinhas.

- [ ] **Step 4: Commit final**

```bash
git add README.md
git commit -m "docs: documenta configurações editáveis (atalhos, comportamento, telas, dados)"
```

---

## Cobertura do spec (self-check)

| Requisito do spec | Task |
|---|---|
| Modelo de dados + merge profundo | 1 |
| Forwarder compartilhado (incl. batalha) | 2 |
| Normalização de combinação | 2 |
| Mapa reverso + ações nomeadas + onChanged no shell | 3 |
| Rótulos dinâmicos (tooltips/status) | 3 |
| startView / startCollapsed / autoSwitchToBattle | 4, 6 (UI) |
| Extração do settings-panel | 5 |
| Seções COMPORTAMENTO/TELAS (UI) | 6 |
| Captura, duplicata, restaurar atalhos, hints | 7 |
| Meus Pokémon expansão default | 8 |
| Batalha seções on/off | 9 |
| Export/import/restaurar tudo | 10 |
| Manifests/build scripts/README + checklist | 11 (background.js nas tasks 3 e 5) |
