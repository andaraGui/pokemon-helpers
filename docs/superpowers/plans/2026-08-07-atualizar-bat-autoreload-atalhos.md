# atualizar.bat, auto-reload e atalhos 1/2/3/4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atualizar a extensão vira "duplo clique no `atualizar.bat` + F5 na página": o script faz o `git pull` e o service worker recarrega a extensão sozinho ao detectar versão nova no disco; de carona, os atalhos padrão mudam para 1/2/3/4 e `` ` ``.

**Architecture:** Três peças independentes: um script batch Windows na raiz do repo (pré-checagens + `git pull --ff-only` + mensagens pt-BR); uma checagem no service worker (`background.js`) que compara a versão do `manifest.json` lida do disco via `fetch(chrome.runtime.getURL(...))` com a carregada (`chrome.runtime.getManifest()`) e chama `chrome.runtime.reload()` quando o disco é estritamente mais novo, disparada por mensagem do content script no foco da página e pelo alarme de update existente; e a troca dos valores padrão de atalhos em `data/extension-storage.js`. O README documenta o fluxo novo.

**Tech Stack:** Batch (cmd Windows), JavaScript de extensão MV3 (service worker + content script), Node 22 para smoke tests com stub de `chrome` (não há framework de testes no repo).

## Global Constraints

- Branch de trabalho: `feat/atualizar-bat-autoreload-atalhos` (já criada; contém o spec).
- Mensagens de UI/script e comentários em pt-BR; README mantém estilo e largura de linha (~72-76 colunas).
- Commits em pt-BR no padrão do repo (`feat:`, `fix:`, `docs:`), terminando com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Reload só quando a versão do disco é ESTRITAMENTE maior que a carregada (evita loop e ignora downgrade).
- O aviso de atualização (update-notice) e a seção Instalação do README não mudam.
- Sem menção à branch `develop` no README (regra do spec anterior continua valendo).
- Spec de referência: `docs/superpowers/specs/2026-08-07-atualizar-bat-autoreload-atalhos-design.md`.

---

### Task 1: `atualizar.bat` + `.gitattributes`

**Files:**
- Create: `atualizar.bat` (raiz do repo)
- Create: `.gitattributes` (raiz do repo)

**Interfaces:**
- Consumes: nada.
- Produces: o arquivo `atualizar.bat` que a Task 4 cita no README pelo nome exato.

- [ ] **Step 1: Criar `atualizar.bat`**

Conteúdo exato (salvar como UTF-8 **sem BOM**; a Write tool já faz isso):

```bat
@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Infinity MMO Extension - Atualizador
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo O Git nao foi encontrado neste computador.
    echo.
    echo Instale o Git em: https://git-scm.com/download/win
    echo Depois execute este arquivo de novo.
    goto :fim
)

if not exist ".git" (
    echo Esta pasta nao foi instalada com Git.
    echo.
    echo Use o fluxo de atualizacao por ZIP descrito no README:
    echo baixe o ZIP de novo e extraia por cima desta pasta.
    goto :fim
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
if not "%BRANCH%"=="main" (
    echo Voltando para a versao estavel ^(branch main^)...
    git switch main
    if errorlevel 1 (
        echo.
        echo Nao foi possivel voltar para a branch main.
        echo Baixe o ZIP pelo README ou peca ajuda.
        goto :fim
    )
)

echo Baixando a versao mais recente...
git pull --ff-only
if errorlevel 1 (
    echo.
    echo Nao foi possivel atualizar automaticamente ^(alteracoes locais
    echo ou historico divergente^).
    echo Baixe o ZIP pelo README ou peca ajuda.
    goto :fim
)

echo.
echo ============================================
echo Atualizado! A extensao vai se recarregar
echo sozinha em alguns instantes.
echo.
echo Depois, recarregue a pagina do jogo (F5).
echo ============================================

:fim
echo.
pause
```

Nota deliberada: as mensagens são pt-BR **sem acentos** — `echo` no cmd com
acentos é frágil mesmo com `chcp 65001` em algumas versões do Windows, e
texto sem acento nunca quebra. O `chcp 65001` fica mesmo assim (barato e
protege qualquer saída do próprio git).

- [ ] **Step 2: Criar `.gitattributes`**

Conteúdo exato:

```
*.bat text eol=crlf
```

- [ ] **Step 3: Verificar a lógica e o atributo**

Checklist de revisão manual do script (não há Windows neste ambiente):
todo caminho termina em `:fim` → `pause` (janela nunca fecha sozinha); os
quatro fluxos de erro têm mensagens distintas (sem git, sem `.git`, switch
falhou, pull falhou); parênteses dentro de `echo` escapados com `^`.

Run: `git check-attr text eol -- atualizar.bat`
Expected: `atualizar.bat: text: set` e `atualizar.bat: eol: crlf`

- [ ] **Step 4: Commit**

```bash
git add atualizar.bat .gitattributes
git commit -m "feat: atualizar.bat para atualizar a extensão com duplo clique

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Auto-reload ao detectar versão nova no disco

**Files:**
- Modify: `background.js` (constantes no topo ~linha 17; nova função após `checkForUpdates`, ~linha 196; `chrome.runtime.onMessage` ~linha 246; `chrome.alarms.onAlarm` ~linha 259)
- Modify: `content.js` (novo bloco após o guard `__pkmnHelperPrefsListenerAdded`, ~linha 75)

**Interfaces:**
- Consumes: `compareVersions(a, b)` já existente em `background.js`.
- Produces: mensagem `{ type: 'pkmn-helper-check-disk-version' }` (content → SW); função `checkDiskVersion()` no SW. A Task 4 descreve o comportamento no README.

- [ ] **Step 1: Escrever o smoke test que reproduz a ausência da feature**

O teste carrega `background.js` em Node com stub de `chrome`, dispara a
mensagem e confere se `chrome.runtime.reload()` foi chamado. Rodar a partir
da raiz do repo (o argumento 3 é `reload` ou `none`):

```bash
node - 1.4.52 1.4.51 reload <<'EOF'
const [,, diskVersion, installedVersion, expect] = process.argv;
let reloaded = false;
const messageHandlers = [];
globalThis.chrome = {
    runtime: {
        id: 'abc',
        lastError: null,
        getManifest: () => ({ version: installedVersion }),
        getURL: (p) => 'chrome-extension://abc/' + p,
        reload: () => { reloaded = true; },
        onMessage: { addListener: (fn) => messageHandlers.push(fn) }
    },
    action: { onClicked: { addListener() {} } },
    commands: { onCommand: { addListener() {} } },
    tabs: { onUpdated: { addListener() {} }, create() {} },
    alarms: { create() {}, clear(name, cb) { if (cb) cb(); }, onAlarm: { addListener() {} } },
    storage: { local: { get: (k, cb) => cb({}), set: (o, cb) => cb() }, onChanged: { addListener() {} } }
};
globalThis.fetch = async (url) => {
    if (String(url).startsWith('chrome-extension://')) {
        return { ok: true, json: async () => ({ version: diskVersion }) };
    }
    return { ok: false, status: 599, json: async () => ({}) };
};
require('./data/extension-storage.js');
require('./background.js');
setTimeout(() => {
    messageHandlers.forEach((fn) => fn({ type: 'pkmn-helper-check-disk-version' }));
    setTimeout(() => {
        const want = expect === 'reload';
        if (reloaded !== want) { console.error(`FALHOU: reloaded=${reloaded}, esperado=${want}`); process.exit(1); }
        console.log(`OK ${diskVersion} vs ${installedVersion} -> ${reloaded ? 'reload' : 'sem reload'}`);
        process.exit(0);
    }, 100);
}, 100);
EOF
```

Avisos `[Pokemon Helper] Não foi possível...` no stderr são esperados (o
stub falha os fetches de habilidades/pokédex de propósito) — só o
`OK`/`FALHOU` e o exit code importam.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: o comando do Step 1.
Expected: `FALHOU: reloaded=false, esperado=true`, exit 1 (a mensagem ainda
não tem handler).

- [ ] **Step 3: Implementar em `background.js`**

Inserir imediatamente após a função `checkForUpdates()` (depois da linha
`}` que a fecha, ~linha 195):

```javascript
// Recarrega a extensão quando o manifest no DISCO (atualizado por
// atualizar.bat/git pull/ZIP) tem versão maior que a carregada: numa
// extensão descompactada, fetch de chrome-extension:// lê o arquivo do
// disco, enquanto getManifest() devolve o que está na memória.
// Estritamente maior — evita loop de reload e ignora downgrade (ex.:
// troca de branch durante o desenvolvimento).
let lastDiskCheckAt = 0;

async function checkDiskVersion() {
    const now = Date.now();
    if (now - lastDiskCheckAt < 5000) return;
    lastDiskCheckAt = now;
    try {
        const installedManifest = chrome.runtime.getManifest();
        const manifestName = installedManifest.browser_specific_settings
            ? 'manifest.firefox.json'
            : 'manifest.json';
        const response = await fetch(chrome.runtime.getURL(manifestName), { cache: 'no-store' });
        const diskManifest = await response.json();
        if (!/^\d+(\.\d+)*$/.test(diskManifest.version || '')) return;
        if (compareVersions(diskManifest.version, installedManifest.version) > 0) {
            chrome.runtime.reload();
        }
    } catch (error) {
        // pull/extração ainda em andamento ou leitura falhou — a próxima
        // checagem (foco ou alarme) tenta de novo
    }
}
```

No listener `chrome.runtime.onMessage` (~linha 246), acrescentar junto das
outras mensagens:

```javascript
    if (msg && msg.type === 'pkmn-helper-check-disk-version') checkDiskVersion();
```

No listener `chrome.alarms.onAlarm` (~linha 259), trocar a linha do
`UPDATE_ALARM`:

```javascript
    if (alarm.name === UPDATE_ALARM) { checkForUpdates(); checkDiskVersion(); }
```

- [ ] **Step 4: Rodar os quatro cenários e confirmar**

Run (mesmo script do Step 1, mudando os argumentos):

```bash
# disco mais novo -> recarrega
node - 1.4.52 1.4.51 reload <<'EOF'
(mesmo corpo do Step 1)
EOF
# disco igual -> nada
node - 1.4.51 1.4.51 none <<'EOF'
(mesmo corpo do Step 1)
EOF
# disco mais velho -> nada
node - 1.4.50 1.4.51 none <<'EOF'
(mesmo corpo do Step 1)
EOF
# versão inválida no disco -> nada
node - lixo 1.4.51 none <<'EOF'
(mesmo corpo do Step 1)
EOF
```

(Repetir o corpo integral do heredoc do Step 1 em cada comando.)
Expected: quatro `OK`, exit 0 em todos.

- [ ] **Step 5: Implementar o gatilho em `content.js`**

Inserir logo após o bloco `if (!window.__pkmnHelperPrefsListenerAdded) { ... }`
(~linha 75):

```javascript
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
        requestDiskCheck();
    }
```

- [ ] **Step 6: Conferir sintaxe do content.js**

Run: `node --check content.js && node --check background.js`
Expected: sem saída, exit 0.

- [ ] **Step 7: Commit**

```bash
git add background.js content.js
git commit -m "feat: extensão se recarrega sozinha ao detectar versão nova no disco

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Atalhos padrão 1/2/3/4 e `` ` ``

**Files:**
- Modify: `data/extension-storage.js:50-58` (objeto `shortcuts` de `DEFAULT_UI_PREFERENCES`)
- Modify: `README.md` (tabela da seção "## Atalhos de teclado")

**Interfaces:**
- Consumes: nada.
- Produces: novos valores padrão; toda a UI já formata dinamicamente (nenhum outro código muda).

- [ ] **Step 1: Escrever o smoke test dos novos padrões**

```bash
node - <<'EOF'
globalThis.chrome = { runtime: { id: 'x' } };
require('./data/extension-storage.js');
require('./components/shortcut-utils.js');
const s = PokemonHelperStorage.DEFAULT_UI_PREFERENCES.shortcuts;
const expected = { battle: '1', calc: '2', myPokemons: '3', settings: '4', typeChart: 't', toggleFull: 'f', minimize: '`' };
for (const [name, key] of Object.entries(expected)) {
    if (s[name] !== key) { console.error(`FALHOU: ${name}=${JSON.stringify(s[name])}, esperado ${JSON.stringify(key)}`); process.exit(1); }
}
const label = PokemonHelperShortcutUtils.formatCombo('`');
if (label !== '`') { console.error("FALHOU: formatCombo('`') exibiu " + JSON.stringify(label)); process.exit(1); }
console.log('OK atalhos padrão e formatCombo');
EOF
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: o comando do Step 1.
Expected: `FALHOU: battle="e", esperado "1"`, exit 1.

- [ ] **Step 3: Trocar os padrões**

Em `data/extension-storage.js`, o bloco atual:

```javascript
        shortcuts: Object.freeze({
            battle: 'e',
            calc: 'c',
            myPokemons: 'm',
            settings: ',',
            typeChart: 't',
            toggleFull: 'f',
            minimize: 'escape'
        }),
```

vira:

```javascript
        shortcuts: Object.freeze({
            battle: '1',
            calc: '2',
            myPokemons: '3',
            settings: '4',
            typeChart: 't',
            toggleFull: 'f',
            minimize: '`'
        }),
```

O comentário acima do bloco (`// ação → combinação normalizada ...`) fica.

- [ ] **Step 4: Rodar o smoke test e confirmar que passa**

Run: o comando do Step 1.
Expected: `OK atalhos padrão e formatCombo`, exit 0.

- [ ] **Step 5: Atualizar a tabela do README**

Na seção "## Atalhos de teclado", a tabela atual:

```markdown
| Ação | Atalho padrão | Onde funciona |
|---|---|---|
| Abrir/fechar o overlay inteiro | `Ctrl+Shift+Y` | Atalho do navegador (`chrome://extensions/shortcuts`) |
| Encontro | `E` | Com foco no painel |
| Calculadora | `C` | Com foco no painel |
| Meus Pokémon | `M` | Com foco no painel |
| Configurações | `,` (vírgula) | Com foco no painel |
| Tabela de tipos | `T` | Com foco no painel |
| Expandir/recolher (modo full) | `F` | Com foco no painel |
| Minimizar/voltar | `Esc` | Com foco no painel |
```

vira (só a coluna "Atalho padrão" muda, e a linha do navegador fica):

```markdown
| Ação | Atalho padrão | Onde funciona |
|---|---|---|
| Abrir/fechar o overlay inteiro | `Ctrl+Shift+Y` | Atalho do navegador (`chrome://extensions/shortcuts`) |
| Encontro | `1` | Com foco no painel |
| Calculadora | `2` | Com foco no painel |
| Meus Pokémon | `3` | Com foco no painel |
| Configurações | `4` | Com foco no painel |
| Tabela de tipos | `T` | Com foco no painel |
| Expandir/recolher (modo full) | `F` | Com foco no painel |
| Minimizar/voltar | `` ` `` (crase) | Com foco no painel |
```

- [ ] **Step 6: Commit**

```bash
git add data/extension-storage.js README.md
git commit -m "feat: atalhos padrão 1/2/3/4 para as views e crase para minimizar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: README — seção "Atualização" com o fluxo novo

**Files:**
- Modify: `README.md:72-89` (seção "## Atualização")

**Interfaces:**
- Consumes: `atualizar.bat` (Task 1) e o auto-reload (Task 2), citados pelo comportamento.
- Produces: nada para outras tasks.

- [ ] **Step 1: Reescrever a seção**

O trecho atual (entre `## Atualização` e `## Primeiros passos`):

```markdown
**Se instalou pelo ZIP:** baixe novamente o ZIP, extraia por cima da pasta
já usada e, em `chrome://extensions`, clique no botão de recarregar (↻) no
card da extensão.

**Se instalou com Git:** abra um terminal dentro da pasta do projeto e
baixe as alterações:

```bash
git pull
```

Depois de atualizar por qualquer um dos métodos, volte a
`chrome://extensions`, clique no botão de recarregar (↻) no card da extensão
e recarregue a página do jogo. Se a checagem automática de versão estiver
ligada (veja [Configurações](#configurações)), uma faixa de aviso aparece no
overlay quando houver uma versão mais nova disponível.
```

vira:

```markdown
**Se instalou com Git (recomendado):** dê dois cliques no arquivo
`atualizar.bat`, dentro da pasta da extensão, e aguarde a mensagem de
sucesso. A extensão percebe a versão nova e se recarrega sozinha em alguns
instantes — depois é só recarregar a página do jogo (F5). Rodar `git pull`
num terminal dentro da pasta tem o mesmo efeito.

**Se instalou pelo ZIP:** baixe novamente o ZIP e extraia por cima da pasta
já usada. A extensão também se recarrega sozinha nesse fluxo — depois,
recarregue a página do jogo (F5).

Se a checagem automática de versão estiver ligada (veja
[Configurações](#configurações)), uma faixa de aviso aparece no overlay
quando houver uma versão mais nova disponível.
```

- [ ] **Step 2: Verificar coerência**

Run: `grep -n -iE "recarregar \(↻\)|develop" README.md`
Expected: nenhuma ocorrência de `develop`; o botão (↻) pode continuar
aparecendo apenas em contextos fora da seção Atualização se algum existir —
dentro da seção reescrita, nenhum.

Run: `grep -n "atualizar.bat" README.md`
Expected: ao menos 1 ocorrência (na seção Atualização).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: seção Atualização com atualizar.bat e auto-reload da extensão

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificação manual final (dono, no Windows/Chrome — fora do escopo dos agentes)

1. `atualizar.bat`: atualiza uma pasta clonada e mostra as mensagens certas
   nos quatro fluxos de erro.
2. Auto-reload: com a extensão carregada, bumpar a versão do `manifest.json`
   no disco e focar a aba do jogo → extensão recarrega sozinha; sem bump,
   nada acontece; F5 restaura o overlay.
3. Atalhos: após "Restaurar atalhos padrão", `1`/`2`/`3`/`4` trocam de view,
   `` ` `` minimiza, `T` e `F` seguem funcionando.
