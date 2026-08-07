# README só `main`, imagens reais e fix de contexto invalidado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o README (instruções sem escolha de branch e imagens reais commitadas) e eliminar o warn repetido "Extension context invalidated" no content script.

**Architecture:** Três mudanças independentes num único PR: edições de texto no `README.md`; cópia de screenshots existentes de `~/Pictures/Screenshots` para `docs/images/`; guard central em `data/extension-storage.js` que detecta contexto de extensão invalidado (`chrome.runtime?.id` ausente) e degrada para valores padrão/no-op com um único aviso.

**Tech Stack:** Markdown, Bash, Python 3 + Pillow (recorte de imagem, já instalado), JavaScript de extensão MV3 (sem framework de testes no repo — verificação via `node -e` com stub de `chrome` e teste manual no navegador).

## Global Constraints

- Branch de trabalho: `docs/readme-main-imagens-e-fix-contexto` (já criada a partir de `origin/main`; o spec está commitado nela).
- O README não deve mencionar a branch `develop` nem instruir escolha de branch (decisão do dono do projeto; o beta é via toggle "Canal beta").
- Não alterar o comportamento do toggle beta em `background.js` — só documentação.
- Textos do README em pt-BR, mantendo o estilo e a largura de linha (~72-76 colunas) do arquivo.
- Mensagens de commit em pt-BR no padrão do repo (`fix:`, `docs:`), terminando com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Spec de referência: `docs/superpowers/specs/2026-08-07-readme-main-imagens-e-fix-contexto-design.md`.

---

### Task 1: README sem escolha de branch

**Files:**
- Modify: `README.md:36-51` (Opção 1 ZIP), `README.md:66-82` (Opção 2 Git), `README.md:84-102` (Atualização), `README.md:237-239` (Canal beta)

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: README sem menção a `develop`; Task 2 edita outras linhas do mesmo arquivo (legendas/comentários de imagem), sem sobreposição de trechos.

- [ ] **Step 1: Remover o passo do seletor de branch da Opção 1 (ZIP)**

No `README.md`, o trecho atual (linhas 36-41):

```markdown
1. Acesse o [repositório da Infinity MMO Extension](https://github.com/andaraGui/pokemon-infinity-mmo-extension).
2. Escolha a versão desejada no seletor de branch:
   - `main`: versão estável;
   - `develop`: versão beta, com funcionalidades que ainda estão em teste.
3. Clique em **Code → Download ZIP**.
```

vira:

```markdown
1. Acesse o [repositório da Infinity MMO Extension](https://github.com/andaraGui/pokemon-infinity-mmo-extension).
2. Clique em **Code → Download ZIP**.
```

Renumerar os passos seguintes da Opção 1 (o antigo 4 vira 3, e assim por
diante, até o antigo 8 virar 7).

- [ ] **Step 2: Corrigir a referência "passos 5-7" no blockquote**

O blockquote logo após a lista da Opção 1 (linha ~51) diz "Em caso de
dúvida nos passos 5-7". Com a renumeração, esses passos (abrir
`chrome://extensions`, modo desenvolvedor, carregar sem compactação)
viram 4-6:

```markdown
> Em caso de dúvida nos passos 4-6, a
```

- [ ] **Step 3: Remover o passo de branch da Opção 2 (Git)**

Trecho atual (linhas 72-79):

```markdown
4. Escolha a branch que deseja usar. Para acessar a versão beta:

   ```bash
   git switch develop
   ```

   Para usar a versão estável, permaneça na branch `main` ou execute
   `git switch main`.
5. Abra `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em
```

Excluir o passo 4 inteiro e renumerar o passo 5 para 4 (a lista da Opção 2
termina com 4 passos: terminal, clone, cd, carregar no navegador).

- [ ] **Step 4: Atualização sem branch**

Três edições na seção "## Atualização":

Parágrafo do ZIP (linhas 86-88), de:

```markdown
**Se instalou pelo ZIP:** baixe novamente o ZIP da branch desejada (`main`
ou `develop`), extraia por cima da pasta já usada e, em `chrome://extensions`,
clique no botão de recarregar (↻) no card da extensão.
```

para:

```markdown
**Se instalou pelo ZIP:** baixe novamente o ZIP, extraia por cima da pasta
já usada e, em `chrome://extensions`, clique no botão de recarregar (↻) no
card da extensão.
```

Parágrafo do Git (linhas 90-96), de:

```markdown
**Se instalou com Git:** abra um terminal dentro da pasta do projeto,
confirme que está na branch desejada e baixe as alterações:

```bash
git switch develop # ou: git switch main
git pull
```
```

para:

```markdown
**Se instalou com Git:** abra um terminal dentro da pasta do projeto e
baixe as alterações:

```bash
git pull
```
```

Frase final da seção (linha ~102): trocar "quando houver uma versão mais
nova disponível na branch escolhida." por "quando houver uma versão mais
nova disponível.".

- [ ] **Step 5: Canal beta sem menção a branch**

Na seção "## Configurações", bloco PAINEL (linhas 237-239), de:

```markdown
- **Canal beta** — toggle, só aparece com "Avisar" ligado (padrão
  desligado). Compara a versão instalada contra a branch `develop` em vez
  de `main`.
```

para:

```markdown
- **Canal beta** — toggle, só aparece com "Avisar" ligado (padrão
  desligado). Inclui as versões beta (em teste) nos avisos de
  atualização.
```

- [ ] **Step 6: Verificar que não sobrou menção a develop/branch**

Run: `grep -n -iE "develop|branch" README.md`
Expected: apenas a linha com `docs/DEVELOPMENT.md` (seção "Para
desenvolvedores"). Nenhuma instrução de escolha de branch, nenhum
`git switch`, nenhum `develop` isolado.

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: instala/atualiza só pela main; beta é o toggle Canal beta

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Imagens reais em `docs/images/`

**Files:**
- Create: `docs/images/capa-overlay.png`, `docs/images/aba-encontro.png`, `docs/images/aba-calculadora.png`, `docs/images/tabela-tipos.png`, `docs/images/modo-full.png`, `docs/images/aba-meus-pokemon.png`, `docs/images/tela-configuracoes.png`
- Delete: `docs/images/.gitkeep`
- Modify: `README.md` (legenda da linha ~224 e os 7 comentários `<!-- TODO imagem: ... -->`)

**Interfaces:**
- Consumes: nada de outras tasks (edita linhas do README que a Task 1 não toca).
- Produces: os 7 arquivos PNG cujos nomes o README já referencia.

- [ ] **Step 1: Copiar e recortar as capturas**

As capturas de origem estão em `~/Pictures/Screenshots` (lote de
2026-08-07). Executar a partir da raiz do repo:

```bash
SRC="$HOME/Pictures/Screenshots"
cp "$SRC/Screenshot From 2026-08-07 15-29-11.png" docs/images/capa-overlay.png
cp "$SRC/Screenshot From 2026-08-07 16-05-44.png" docs/images/aba-encontro.png
cp "$SRC/Screenshot From 2026-08-07 15-27-15.png" docs/images/aba-calculadora.png
cp "$SRC/Screenshot From 2026-08-07 15-26-09.png" docs/images/modo-full.png
cp "$SRC/Screenshot From 2026-08-07 15-03-14.png" docs/images/aba-meus-pokemon.png
cp "$SRC/Screenshot From 2026-08-07 15-03-50.png" docs/images/tela-configuracoes.png
python3 - <<'EOF'
from PIL import Image
im = Image.open('docs/images/modo-full.png')
im.crop((0, 38, 1345, 700)).save('docs/images/tabela-tipos.png')
EOF
rm docs/images/.gitkeep
```

O recorte isola a tabela 18×18 (lado esquerdo do modo full, sem o painel
da calculadora à direita). A imagem original tem 1692×869.

- [ ] **Step 2: Conferir o recorte visualmente**

Abrir/inspecionar `docs/images/tabela-tipos.png` (ferramenta Read do
agente ou visualizador de imagens). Expected: título "TABELA DE TIPOS",
a matriz completa com as 18 linhas (NRM até FRY) e a legenda "Linhas =
quem ataca…" visíveis; nada do painel ATAQUE/DEFESA da direita. Se cortar
conteúdo, ajustar as coordenadas do crop (aumentar 700 ou 1345) e repetir.

- [ ] **Step 3: Ajustar legenda de Meus Pokémon e remover os TODO de imagem**

No `README.md`, linha ~224, de:

```markdown
![Aba Meus Pokémon com filtros avançados abertos](docs/images/aba-meus-pokemon.png)
```

para:

```markdown
![Aba Meus Pokémon com o time expandido e detalhes abertos](docs/images/aba-meus-pokemon.png)
```

Remover as 7 linhas de comentário `<!-- TODO imagem: ... -->` (linhas 10,
165, 182, 196, 225, 293, 296 — logo abaixo de cada referência de imagem).

- [ ] **Step 4: Verificar que nomes e arquivos batem**

Run: `grep -oE 'docs/images/[a-z-]+\.png' README.md | sort -u | while read f; do [ -f "$f" ] && echo "OK $f" || echo "FALTA $f"; done; grep -c "TODO imagem" README.md || true`
Expected: `OK` para os 7 arquivos, nenhum `FALTA`, e `0` TODOs restantes.

- [ ] **Step 5: Commit**

```bash
git add docs/images README.md
git commit -m "docs: adiciona screenshots reais do overlay ao README

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Guard de contexto invalidado em `extension-storage.js`

**Files:**
- Modify: `data/extension-storage.js:75-99` (funções `read` e `write`; novas funções auxiliares logo acima delas)

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `read(key, defaults)` resolve com cópia dos defaults e `write(key, value)` resolve com `value` sem tocar o `chrome.storage` quando o contexto está invalidado; consumidores (`ability-info.js`, `battle.js`, etc.) não mudam.

- [ ] **Step 1: Escrever o smoke test que reproduz a falha**

O repo não tem framework de testes; usar `node -e` com um stub de `chrome`
sem `storage` (o que um contexto invalidado provoca — hoje isso rejeita).
A partir da raiz do repo:

```bash
node -e "
globalThis.chrome = { runtime: {} };            // sem id => contexto inválido
require('./data/extension-storage.js');
PokemonHelperStorage.getAbilities()
  .then(v => { console.log('READ_OK', JSON.stringify(v)); return PokemonHelperStorage.setAbilities({ items: [1] }); })
  .then(v => console.log('WRITE_OK', JSON.stringify(v)))
  .catch(e => { console.error('FALHOU', e.message); process.exit(1); });
"
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: o comando do Step 1.
Expected: FALHOU com `Cannot read properties of undefined (reading 'local')`
(exit 1) — é o análogo do "Extension context invalidated" no navegador.

- [ ] **Step 3: Implementar o guard**

Em `data/extension-storage.js`, inserir imediatamente antes de
`function read(key, defaults) {` (linha 75):

```javascript
    // Depois de recarregar/atualizar a extensão, o content script antigo
    // continua vivo na aba com o contexto morto: chrome.runtime.id some e
    // qualquer chamada ao chrome.storage lança "Extension context
    // invalidated". Degrada para os padrões e avisa uma única vez.
    let invalidContextNotified = false;

    function isContextValid() {
        return Boolean(globalThis.chrome?.runtime?.id);
    }

    function invalidContextFallback(value) {
        if (!invalidContextNotified) {
            invalidContextNotified = true;
            console.info('[Pokemon Helper] A extensão foi atualizada ou recarregada. Recarregue a página do jogo para reativar o overlay.');
        }
        return Promise.resolve(value);
    }
```

Substituir `read` e `write` (linhas 75-99 atuais) por:

```javascript
    function read(key, defaults) {
        if (!isContextValid()) return invalidContextFallback(Object.assign({}, defaults));
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(key, (result) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(Object.assign({}, defaults, result[key] || {}));
                });
            } catch (error) {
                // contexto invalidado entre a checagem e a chamada
                resolve(invalidContextFallback(Object.assign({}, defaults)));
            }
        });
    }

    function write(key, value) {
        if (!isContextValid()) return invalidContextFallback(value);
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ [key]: value }, () => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(value);
                });
            } catch (error) {
                resolve(invalidContextFallback(value));
            }
        });
    }
```

- [ ] **Step 4: Rodar o smoke test e confirmar que passa**

Run: o comando do Step 1.
Expected: exit 0 com, nesta ordem: uma única linha `console.info` do
aviso, depois `READ_OK {"items":[],"checkedAt":null,"error":null}` e
`WRITE_OK {"items":[1]}`. Rodar duas leituras seguidas
(`getAbilities().then(() => PokemonHelperStorage.getPokedex())`) num
segundo comando se quiser confirmar que o aviso não se repete.

- [ ] **Step 5: Confirmar que o caminho normal não regrediu**

Run:

```bash
node -e "
const store = {};
globalThis.chrome = {
    runtime: { id: 'abc', lastError: null },
    storage: { local: {
        get: (key, cb) => cb({ [key]: store[key] }),
        set: (obj, cb) => { Object.assign(store, obj); cb(); }
    } }
};
require('./data/extension-storage.js');
PokemonHelperStorage.setAbilities({ items: ['x'], checkedAt: 't', error: null })
  .then(() => PokemonHelperStorage.getAbilities())
  .then(v => console.log('OK', JSON.stringify(v)))
  .catch(e => { console.error('FALHOU', e.message); process.exit(1); });
"
```

Expected: `OK {"items":["x"],"checkedAt":"t","error":null}`, sem aviso de
contexto e exit 0.

- [ ] **Step 6: Commit**

```bash
git add data/extension-storage.js
git commit -m "fix: storage degrada sem spam de erro quando o contexto da extensão é invalidado

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Verificação manual no navegador (pós-implementação)**

Com a extensão carregada e a página do jogo aberta: em
`chrome://extensions`, recarregar a extensão (↻) sem recarregar a página;
interagir com o overlay (trocar de aba, entrar em batalha). Expected: no
console da página, no máximo um `console.info` pedindo reload, sem warns
repetidos de "Não foi possível carregar habilidades: … Extension context
invalidated". Após recarregar a página, o overlay volta ao normal. Este
passo exige o navegador do usuário; se o executor for um agente, marcar
como pendente para o usuário confirmar.
