# Correções do painel — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 5 problemas do painel: barra de IV sem preenchimento, golpes do oponente que somem, tabela à esquerda no modo expandido, atalhos que exigem foco no painel, e a fonte Pixelify Sans ilegível para números.

**Architecture:** Extensão MV3 sem build/bundler — HTML/CSS/JS puros carregados direto pelo browser. O shell do overlay (`content.js`, isolated world) hospeda iframes (`battle.html`, `index.html`, `myPokemons.html`, `chart.html`) e um `<div>` de configurações. Todas as mudanças são em CSS e JS existentes; nenhum arquivo novo.

**Tech Stack:** JavaScript vanilla, CSS, Chrome/Firefox MV3.

**Spec:** `docs/superpowers/specs/2026-08-07-correcoes-painel-design.md`

## Global Constraints

- **Sem build step.** Testar carregando a extensão descompactada da raiz do repo (`chrome://extensions`). Não rodar `scripts/build-*.sh`.
- **Não bumpar a versão** em `manifest.json`/`manifest.firefox.json` (só em release).
- **Nenhum arquivo novo** é criado — não é preciso tocar nos manifests nem nos arrays `FILES` dos scripts de build.
- **Não renomear** identificadores `pokemon-helper-*`/`pkmn-helper-*` nem o prefixo de console `[Pokemon Helper]`.
- Comentários e mensagens de commit em **português**; identificadores de código em inglês.
- **Sem suíte de testes no projeto** (AGENTS.md). Cada tarefa valida com `node --check` (sintaxe) onde há JS e com a checagem estática indicada; a verificação visual completa é a Tarefa 6, feita pelo usuário no jogo (DevTools em `infinitymmo.net` requer o workaround descrito em docs/DEVELOPMENT.md, seção "DevTools no infinitymmo.net").
- Branch de trabalho: `fix/ajustes-painel` (já existe, contém a spec). Um commit por tarefa.

---

### Task 1: Preenchimento da barra de IV

A barra existe (`.px-bar` = trilho, `.px-bar-fill` = preenchimento com `width:N%` inline calculado por `battle.js`/`myPokemons.js`), mas `.px-bar-fill` é um `<span>` sem `display` definido — elemento inline não-substituído ignora `width`/`height`, então o preenchimento nunca aparece. O trilho só aparece porque `.px-bar` vira flex item (blockificado) nos dois contextos onde é usado.

**Files:**
- Modify: `pixel-theme.css:96-97`

**Interfaces:**
- Consumes: nada.
- Produces: nada (mudança puramente visual; nenhuma outra tarefa depende).

- [ ] **Step 1: Corrigir o CSS**

Em `pixel-theme.css`, substituir:

```css
.px-bar { height: 5px; background: var(--px-bg-track); }
.px-bar-fill { height: 100%; }
```

por:

```css
.px-bar { display: block; height: 5px; background: var(--px-bg-track); }
/* span inline ignora width/height — sem display block o preenchimento não renderiza */
.px-bar-fill { display: block; height: 100%; }
```

- [ ] **Step 2: Checagem estática**

Run: `grep -n "px-bar" pixel-theme.css`
Expected: as duas regras contêm `display: block`.

- [ ] **Step 3: Commit**

```bash
git add pixel-theme.css
git commit -m "fix: preenchimento da barra de IV renderiza (display block no px-bar-fill)"
```

---

### Task 2: Golpes do oponente — mesclar confirmados e estimados

Hoje `resolveFoeMoves` retorna **uma** fonte por prioridade: assim que um golpe é visto em batalha (`discovered`), a lista descoberta substitui a estimada inteira e a seção GOLPES DELE encolhe para só os confirmados. A correção mescla as fontes numa lista única de até 4 golpes (dedupe por slug), com selo VISTO nos confirmados.

**Files:**
- Modify: `battle.js:254-272` (função `resolveFoeMoves` + `MOVE_SOURCE_LABELS`), `battle.js:315-359` (função `renderFoeMoves`)
- Modify: `battle.html` (CSS: bloco de estilos, perto da regra `.move-name`, linha ~73)

**Interfaces:**
- Consumes: `discoveredMovesFor(foe)` → `string[] | null`; `trainerMovesFor(foe)` → `string[] | null`; `probableMoves(foe)` → `{slug, type}[]`; `movesWithTypes(slugs)` → `{slug, type}[]` (todas já existem em battle.js, não mudam).
- Produces: `resolveFoeMoves(foe)` → `{ moves: {slug, type, source}[], seenCount: number }` onde `source` ∈ `'discovered' | 'trainer' | 'heuristic'`. Consumido apenas por `renderFoeMoves` nesta mesma tarefa.

- [ ] **Step 1: Reescrever `resolveFoeMoves` em battle.js**

Substituir a função atual (e seu comentário de 4 linhas logo acima, "// resolve os golpes do oponente na seguinte ordem de prioridade...") por:

```js
// resolve os golpes do oponente mesclando as fontes (dedupe por slug, máx. 4):
// 1) golpes já vistos em batalhas anteriores contra esse mesmo oponente recorrente;
// 2) moveset exato de treinador (quando é batalha de treinador e casa espécie+nível);
// 3) heurística por nível (fallback pra selvagens/sem dados de treinador).
// Cada golpe carrega sua origem — confirmados ganham selo VISTO na renderização.
// Mesclar (em vez de substituir pela fonte de maior prioridade) garante que a
// lista nunca encolhe no meio da luta quando um golpe é confirmado.
function resolveFoeMoves(foe) {
    const discovered = discoveredMovesFor(foe) || [];
    const merged = [];
    const seen = new Set();
    const push = (moves, source) => moves.forEach((move) => {
        if (merged.length >= 4 || seen.has(move.slug)) return;
        seen.add(move.slug);
        merged.push({ ...move, source });
    });
    push(movesWithTypes(discovered), 'discovered');
    if (state.kind === 'trainer') push(movesWithTypes(trainerMovesFor(foe) || []), 'trainer');
    push(probableMoves(foe), 'heuristic');
    return { moves: merged, seenCount: discovered.length };
}
```

- [ ] **Step 2: Novo hint do cabeçalho da seção**

Logo após o objeto `MOVE_SOURCE_LABELS` (que permanece como está), adicionar:

```js
// texto do ⓘ do cabeçalho GOLPES DELE: fonte única usa o rótulo existente;
// lista mista explica o selo VISTO
function foeMovesHint(resolved) {
    const sources = new Set(resolved.moves.map((move) => move.source));
    if (sources.size <= 1) return MOVE_SOURCE_LABELS[resolved.moves[0]?.source] || '';
    return `${resolved.seenCount} confirmado(s) em batalha (selo VISTO); os demais são estimados (wiki do treinador ou nível).`;
}
```

- [ ] **Step 3: Atualizar `renderFoeMoves`**

Substituir as linhas que montam `sourceHint`:

```js
    const sourceHint = MOVE_SOURCE_LABELS[resolved.source]
        + (resolved.source === 'discovered' && resolved.seenCount < 4 ? ` (${resolved.seenCount}/4 vistos até agora)` : '');
```

por:

```js
    const sourceHint = foeMovesHint(resolved);
```

E, dentro do template do item de golpe, substituir a linha do `move-info`:

```js
                <span class="move-info"><span class="move-name">${escapeHtml(moveLabel(move.slug))}</span><span class="move-sub">${sub}</span></span>
```

por:

```js
                <span class="move-info"><span class="move-name-row"><span class="move-name">${escapeHtml(moveLabel(move.slug))}</span>${move.source === 'discovered' ? '<span class="move-seen" data-tip="Golpe confirmado: visto em batalha contra esse oponente.">VISTO</span>' : ''}</span><span class="move-sub">${sub}</span></span>
```

- [ ] **Step 4: CSS do selo em battle.html**

No bloco `<style>` de `battle.html`, logo após a regra `.move-name` (linha ~73), adicionar:

```css
        .move-name-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
        .move-seen { flex: 0 0 auto; font-family: var(--px-font-mono); font-size: 8px; letter-spacing: .5px; color: var(--px-good); border: 1px solid var(--px-good); padding: 1px 4px; }
```

- [ ] **Step 5: Checagem de sintaxe**

Run: `node --check battle.js`
Expected: sem saída (sintaxe ok).

- [ ] **Step 6: Commit**

```bash
git add battle.js battle.html
git commit -m "fix: golpes do oponente mesclam confirmados e estimados em vez de substituir"
```

---

### Task 3: View ativa à esquerda no modo expandido

No modo expandido (`.full-side`), a tabela 18×18 tem `order: 0` (esquerda) e a view ativa `order: 1` (direita). Inverter: view ativa (calculadora/batalha) à esquerda com largura fixa, tabela preenchendo a direita.

**Files:**
- Modify: `content.js:507-508` (stylesheet injetado em `injectStyle()`)

**Interfaces:**
- Consumes: nada.
- Produces: nada (só CSS; `syncFullSide` não muda).

- [ ] **Step 1: Inverter os `order` e o lado da borda**

Em `content.js`, dentro de `injectStyle()`, substituir:

```css
            #${ID}.full-side #pokemon-chart-frame { display: block; flex: 1 1 auto; min-width: 0; order: 0; }
            #${ID}.full-side .ph-frame.side-active { display: block; flex: 0 0 var(--ph-side-width, 360px); border-left: 2px solid #23232f; order: 1; }
```

por:

```css
            #${ID}.full-side #pokemon-chart-frame { display: block; flex: 1 1 auto; min-width: 0; order: 1; }
            #${ID}.full-side .ph-frame.side-active { display: block; flex: 0 0 var(--ph-side-width, 360px); border-right: 2px solid #23232f; order: 0; }
```

- [ ] **Step 2: Checagem de sintaxe**

Run: `node --check content.js`
Expected: sem saída.

- [ ] **Step 3: Commit**

```bash
git add content.js
git commit -m "fix: view ativa fica à esquerda da tabela de tipos no modo expandido"
```

---

### Task 4: Atalhos globais + devolução de foco ao jogo

Duas mudanças combinadas (decisão do usuário: a extensão **consome** a tecla de atalho — o jogo não a vê):

1. Atalhos passam a funcionar com o foco no documento do jogo, via listener global de `keydown` em capture phase. O listener antigo do container sai (dispararia em dobro).
2. Depois de cliques no painel, o foco volta ao jogo (blur do iframe/botão), exceto na aba Configurações.

**Cuidado crítico com a captura de atalho:** `settings-panel.js` registra `onCaptureKey` no `document` em capture phase **quando a captura começa** — ou seja, DEPOIS do nosso listener global, que portanto dispara primeiro. Sem guard, gravar uma tecla que já é atalho de outra ação seria impossível (o global consumiria o evento). O guard é a presença do botão `.ph-key-btn.capturing` no DOM (classe que o settings-panel põe durante a captura) — funciona mesmo com o foco fora do painel, que é como a captura opera.

**Files:**
- Modify: `content.js` — função `performAction` (linha ~324), remoção do listener do container (linhas ~358-363), bloco do listener de `message` (linhas ~369-381), novo bloco de listener global (após o bloco de message), novo listener de clique do container (dentro de `build()`)
- Modify: `components/shortcut-forwarder.js`

**Interfaces:**
- Consumes: `PokemonHelperShortcutUtils.comboFromEvent(evt)` → `string|null`; `uiPrefs().shortcuts` → `{[action]: combo}`; `performAction(action)`, `setCollapsed`, `currentSettings`, `VIEW_ACTIONS` (todos já existem em content.js). Classe `.ph-key-btn.capturing` (settings-panel.js, já existe). Classe `.ph-frame` nos iframes (já existe).
- Produces: mensagem `{ type: 'panel-interaction' }` postada pelos iframes ao shell (novo protocolo, consumido só dentro desta tarefa).

- [ ] **Step 1: `performAction` funciona com o painel em bolha**

Em `content.js`, substituir o início de `performAction`:

```js
        function performAction(action) {
            const container = document.getElementById(ID);
            if (!container || container.classList.contains('collapsed')) return;
            const settings = currentSettings(container);
```

por:

```js
        function performAction(action) {
            const container = document.getElementById(ID);
            if (!container) return;
            if (container.classList.contains('collapsed')) {
                // da bolha, atalho de view expande e abre a aba;
                // toggleFull/minimize não fazem sentido colapsado
                if (!VIEW_ACTIONS[action] && action !== 'typeChart') return;
                setCollapsed(container, currentSettings(container), false);
            }
            const settings = currentSettings(container);
```

Atenção: `performAction` referencia `VIEW_ACTIONS`, declarado com `const` algumas linhas acima dela — a ordem atual do arquivo já garante isso; não mover declarações.

- [ ] **Step 2: Remover o listener de keydown do container**

Remover estas linhas (o comentário incluso — a premissa dele deixa de valer):

```js
        // atalhos só valem com o evento no painel (nunca no documento do jogo —
        // o jogo usa essas teclas pra gameplay)
        container.addEventListener('keydown', (event) => {
            if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
            handleShortcut(event);
        });
```

`handleShortcut` continua existindo — ainda é usado pelas mensagens `panel-shortcut` dos iframes.

- [ ] **Step 3: Listener global de atalhos**

Logo após o bloco `if (!window.__pkmnHelperShortcutListenerAdded) { ... }`, adicionar:

```js
        // atalhos globais: funcionam com o foco no documento do jogo. Tecla que
        // bate com um atalho configurado é CONSUMIDA (o jogo não a vê) — quem
        // quiser reservar uma tecla pro jogo troca o atalho nas Configurações.
        // Capture phase pra agir antes dos listeners do próprio jogo; guarda em
        // window pela mesma razão do bloco acima (o listener fica no document,
        // que sobrevive aos toggles do painel).
        if (!window.__pkmnHelperGlobalShortcutAdded) {
            window.__pkmnHelperGlobalShortcutAdded = true;
            document.addEventListener('keydown', (event) => {
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
                const combo = PokemonHelperShortcutUtils.comboFromEvent(event);
                if (!combo) return;
                const shortcuts = uiPrefs().shortcuts;
                const action = Object.keys(shortcuts).find((name) => shortcuts[name] === combo);
                if (!action) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                performAction(action);
            }, true);
        }
```

- [ ] **Step 4: Devolução de foco — mensagens dos iframes**

Dentro do listener de `message` existente (bloco `__pkmnHelperShortcutListenerAdded`), após o `if (data.type === 'panel-exit-full') {...}`, adicionar:

```js
                if (data.type === 'panel-interaction') {
                    // clique dentro de um iframe do painel moveu o foco pra ele e o
                    // jogo parou de receber teclado — devolve o foco ao documento
                    // do jogo tirando-o do iframe
                    const overlay = document.getElementById(ID);
                    if (!overlay || overlay.dataset.activeView === 'settings') return;
                    const active = document.activeElement;
                    if (active && active.classList && active.classList.contains('ph-frame')) active.blur();
                }
```

- [ ] **Step 5: Devolução de foco — cliques no shell**

Dentro de `build()`, logo após o `header.addEventListener('click', ...)` existente, adicionar:

```js
        // cliques no shell (cabeçalho, botões) focam o elemento clicado e
        // "roubam" o teclado do jogo — devolve o foco após o clique. Exceção:
        // aba Configurações, onde inputs e captura de atalho precisam de foco.
        container.addEventListener('click', () => {
            if (container.dataset.activeView === 'settings') return;
            const active = document.activeElement;
            if (active && container.contains(active) && !/INPUT|TEXTAREA|SELECT/.test(active.tagName)) active.blur();
        });
```

- [ ] **Step 6: Clique nos iframes avisa o shell**

Em `components/shortcut-forwarder.js`, após o listener de `keydown` existente (dentro da mesma IIFE), adicionar:

```js
    // cliques também são repassados: o clique focou este iframe e o jogo parou
    // de receber teclado — o shell decide se devolve o foco (content.js,
    // mensagem 'panel-interaction')
    window.addEventListener('click', (event) => {
        if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
        window.parent.postMessage({ type: 'panel-interaction' }, '*');
    });
```

- [ ] **Step 7: Checagem de sintaxe**

Run: `node --check content.js && node --check components/shortcut-forwarder.js`
Expected: sem saída.

- [ ] **Step 8: Commit**

```bash
git add content.js components/shortcut-forwarder.js
git commit -m "feat: atalhos globais com foco no jogo e devolução de foco após cliques no painel"
```

---

### Task 5: Silkscreen como fonte única

Decisão do usuário após comparação visual: Silkscreen para tudo (letras e números), aposentando a Pixelify Sans. O token `--px-font-body` passa a Silkscreen; referências diretas à Pixelify saem; o `@font-face` dela (~12 KB base64) é removido; textos que eram Pixelify 13–15px encolhem (Silkscreen é mais larga no mesmo corpo). Regras que já eram `--px-font-mono` (Silkscreen) não mudam.

**Files:**
- Modify: `pixel-theme.css` (token linha ~57 + remoção do primeiro `@font-face`)
- Modify: `content.js` (font-family do container, linha ~481; tamanhos nas regras `.ph-setting-label`, `.ph-key-desc`, `.ph-hint`)
- Modify: `components/tooltip.js:38`
- Modify: `components/pokemon-filters.css` (`.pxl-input`, linha ~251)
- Modify: `battle.html`, `myPokemons.html`, `index.html`, `chart.html` (font-sizes)

**Interfaces:**
- Consumes: token `--px-font-body` (todos os HTML já o usam no `body`).
- Produces: nada além do valor novo do token.

- [ ] **Step 1: Trocar o token e remover o @font-face da Pixelify**

Em `pixel-theme.css`:

1. Na declaração de tokens: `--px-font-body: 'Pixelify Sans', monospace;` → `--px-font-body: 'Silkscreen', monospace;`
2. Remover o bloco `@font-face { font-family: "Pixelify Sans"; ... }` inteiro (primeiro bloco do arquivo, com o base64). Os dois `@font-face` da Silkscreen (400 e 700) ficam.

- [ ] **Step 2: Referências diretas fora do token**

- `content.js` (~linha 481, estilo do container `#${ID}`): `font-family: 'Pixelify Sans', monospace;` → `font-family: 'Silkscreen', monospace;`
- `components/tooltip.js:38`: `font-family: 'Pixelify Sans', monospace; font-size: 15px;` → `font-family: 'Silkscreen', monospace; font-size: 12px;`

Depois: `grep -rn "Pixelify" --include="*.js" --include="*.css" --include="*.html" . | grep -v dist | grep -v worktrees | grep -v .superpowers | grep -v docs/`
Expected: no máximo menções em comentários (ex.: pokemon-filters.css:240) — atualizar o comentário se ele afirmar algo que deixou de valer; nenhuma referência funcional.

- [ ] **Step 3: Passe de tamanhos (valores iniciais; ajuste fino na Tarefa 6)**

Textos que eram Pixelify: 15px → 12px, 14px → 12px, 13px → 11px. Regras já em `--px-font-mono` **não mudam**.

- `battle.html`: `body` 15→12; `.meta-val` 15→12; `.iv-stat` 14→12; `.move-name` 15→12; `.move-sub` 13→11; `.status-note` 14→12.
- `myPokemons.html`: `body` 15→12; `.pokemon-level` 15→12; `.detail-val` 15→12; `.pokemon-move-name` 15→12.
- `index.html`: `body` 15→12.
- `chart.html`: `body` 15→12; `.chart-caption` 14→12.
- `content.js`: `.ph-setting-label` 15→12; `.ph-key-desc` 15→12; `.ph-hint` 13→11.
- `components/pokemon-filters.css`: `.pxl-input` (regra com `font-size: 15px`, linha ~251) 15→12.

- [ ] **Step 4: Checagem de sintaxe e sobras**

Run: `node --check content.js && node --check components/tooltip.js && ! grep -q "Pixelify" pixel-theme.css`
Expected: comando termina com exit code 0 (sintaxe ok e nenhuma menção a Pixelify restante no pixel-theme.css).

- [ ] **Step 5: Commit**

```bash
git add pixel-theme.css content.js components/tooltip.js components/pokemon-filters.css battle.html myPokemons.html index.html chart.html
git commit -m "feat: Silkscreen como fonte única do painel"
```

---

### Task 6: QA manual no jogo (com o usuário)

Sem suíte de testes — a validação final é visual, no `infinitymmo.net`, com a extensão recarregada (`chrome://extensions` → recarregar → F5 no jogo). Pedir ao usuário que confira o checklist; qualquer ajuste fino de font-size (Tarefa 5) é feito aqui com base no feedback.

**Files:**
- Modify: possivelmente os mesmos da Tarefa 5 (ajuste fino de tamanhos).

**Interfaces:** nada novo.

- [ ] **Step 1: Checklist com o usuário**

1. **IVs:** numa batalha, as 6 barras do grid IVS/STATS aparecem preenchidas na proporção e cor do IV; idem a barra de IV nos cards de Meus Pokémon.
2. **Golpes:** ao entrar numa luta, GOLPES DELE lista os estimados; depois que o oponente usa um golpe, a lista mantém o tamanho e o golpe usado ganha o selo VISTO; o ⓘ do cabeçalho descreve a mistura.
3. **Expandido:** com a calculadora (ou batalha) ativa, tecla F: view ativa à esquerda (largura encaixada), tabela 18×18 à direita.
4. **Atalhos:** com o foco no jogo (sem nunca clicar no painel), E/C/M/T/F/ESC acionam o painel e o jogo NÃO reage à tecla consumida; com o painel em bolha, E/C/M/T abrem painel + aba; após clicar em botões do painel, o teclado do jogo volta a funcionar sem clique extra; digitar no chat do jogo não aciona atalho; nas Configurações, gravar um atalho novo funciona — inclusive regravar uma tecla que já é atalho de outra ação.
5. **Fonte:** todo o painel em Silkscreen (batalha, calculadora, Meus Pokémon, tabela, configurações, tooltips); acentos minúsculos corretos (Médio, Físico, Precisão, Evasão); nenhum texto estourando contêiner. Se algum glifo acentuado renderizar errado, re-embutir a Silkscreen com subset latino completo (mesmo padrão base64 dos @font-face) — tratar como follow-up desta tarefa.

- [ ] **Step 2: Ajustes de tamanho apontados pelo usuário**

Aplicar correções pontuais de `font-size` (±1–2px) nos arquivos da Tarefa 5 conforme o feedback.

- [ ] **Step 3: Commit (se houve ajustes)**

```bash
git add -A -- battle.html myPokemons.html index.html chart.html content.js components/pokemon-filters.css components/tooltip.js
git commit -m "fix: ajuste fino de tamanhos após QA visual da Silkscreen"
```
