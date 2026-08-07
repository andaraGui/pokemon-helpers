# Novo Layout do Painel + Design System Pixel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o design system e o layout do mockup "Extensao Painel (standalone).html" a todo o painel da extensão, mantendo a arquitetura atual (shell `content.js` + 4 iframes) e todas as funcionalidades existentes.

**Architecture:** Restilização no lugar. `pixel-theme.css` vira a única fonte de tokens (fontes, cores, classes compartilhadas). Dois componentes novos (`components/pixel-icon.js`, `components/tooltip.js`) fornecem ícones pixel 7×7 e tooltips globais. Cada tela é reescrita visualmente por cima da sua lógica atual; o shell ganha barra de abas com ícones pixel, barra de status, atalhos de teclado e modo full com a tabela ao lado.

**Tech Stack:** HTML/CSS/JS puro, sem build (extensão MV3 carregada unpacked). Sem dependências externas.

**Spec:** `docs/superpowers/specs/2026-08-06-novo-layout-design-system-design.md`

## Global Constraints

- **NÃO bumpar a versão** em `manifest.json`/`manifest.firefox.json` (regra do repo: bump só em release).
- **Sem requests externos em runtime**: fontes embutidas como data-URI no CSS.
- **Não tocar** em `interceptor.js` nem no roteamento por forma de payload (`data.foe`/`data.party`/`data.pc`) em `content.js`.
- Comentários/commits em português; identificadores em inglês (padrão do repo).
- `components/*.js` e `components/*.css` já estão cobertos por glob no `web_accessible_resources` dos dois manifests, e os build scripts copiam `components/` e `data/` inteiros — **arquivos novos de componente não exigem mudança em manifest nem em build script**. Não editar manifests neste trabalho.
- Não há suíte de testes. Verificação por task = `node --check` em cada JS alterado + carregar a extensão unpacked no Chromium (`chrome://extensions` → Load unpacked na raiz do repo → recarregar a extensão e a aba do jogo) e exercitar a tela. As páginas iframe **não funcionam via `file://`** (dependem de `chrome.storage`).
- Trabalhar no branch `feat/novo-layout-pixel` criado a partir de `develop`.
- Fonte dos assets do mockup: os woff2 já extraídos em
  `/tmp/claude-1000/-home-ndr-server-projects-pokemon-helpers/24acb54d-4067-4dbb-aeaa-b09b8096bc00/scratchpad/`
  (`pixelify-sans-latin.woff2`, `silkscreen-400-latin.woff2`, `silkscreen-700-latin.woff2`).
  Se esse diretório não existir mais, reextrair do bundle
  `/home/ndr-server/Downloads/Extensao Painel (standalone) (1).html` com o script do Task 1.
- **Desvio consciente da spec:** os atalhos de teclado NÃO são capturados no documento do jogo — o jogo usa o teclado para gameplay e capturar `E`/`C`/`M` ali trocaria de aba no meio da partida. Os atalhos valem quando o foco/evento está no painel (shell ou iframes). O restante da spec vale integralmente.

## Paleta e dados de referência (usados por várias tasks)

Tokens (definidos no Task 1, consumidos em todas as telas):

| Variável | Valor | Uso |
|---|---|---|
| `--px-bg-bar` | `#08080d` | barra de abas, barra de status, tooltip |
| `--px-bg` | `#0d0d14` | fundo do painel |
| `--px-bg-card` | `#11111a` | cartões/células |
| `--px-bg-btn` | `#12121b` | botão de aba inativo |
| `--px-bg-cell` | `#14141d` | célula neutra da matriz |
| `--px-bg-btn2` | `#16161f` | botões de ação inativos |
| `--px-bg-track` | `#1a1a24` | trilhos de barra, badge de tecla |
| `--px-bg-badge` | `#2a2a36` | badge neutro (POT, 1×) |
| `--px-line` | `#1c1c26` | hairline |
| `--px-border` | `#23232f` | borda padrão |
| `--px-border-btn` | `#2b2b39` | borda de botão |
| `--px-border-tip` | `#3a3a4c` | borda do tooltip |
| `--px-text-hi` | `#ffffff` | títulos |
| `--px-text` | `#e6e6f0` | corpo |
| `--px-text-val` | `#c8c8dc` | valores |
| `--px-text-soft` | `#a8a8c0` | secundário |
| `--px-text-dim` | `#8a8aa0` | labels/mudo |
| `--px-on-dark` | `#0c0c11` | texto sobre acento/verde |
| `--px-accent` | `#ffb545` | âmbar (ativo, links, destaques) |
| `--px-accent-hover` | `#ffd08a` | hover de link |
| `--px-good` | `#63bb5b` | verde |
| `--px-bad` | `#ea6f83` | vermelho |
| `--px-female` | `#f56a8a` | símbolo ♀ |
| `--px-male` | `#4a90e2` | símbolo ♂ |
| `--px-mid` | `#d9a642` | faixa média de IV |
| `--px-best-border` | `#4a3a12` | borda da caixa Melhor Jogada |

Cores de multiplicador (fundo/texto):

| Valor | Fundo | Texto |
|---|---|---|
| 4× | `#2f9e5e` | `#0c0c11` |
| 2× | `#3f8f5a` | `#0c0c11` |
| 1× | `#2a2a36` | `#a8a8c0` |
| ½× | `#8a4550` | `#ffe0e4` |
| ¼× | `#6e3540` | `#ffe0e4` |
| 0× | `#3a3a4c` | `#cfcfe0` |

Cores de tipo (chaves em inglês = as usadas por `type-tag.js`):

```
normal #9a9a80   fire #f0803c    water #4a90e2   electric #f5cd35
grass #63bb5b    ice #7fd6d6     fighting #d3425f poison #b763cf
ground #d9a642   flying #8f7fe0  psychic #f56a8a bug #92bc2c
rock #c9b787     ghost #7b62a3   dragon #5f6fe8  dark #6f6880
steel #8fa5b8    fairy #ee90c0
```

Bitmaps 7×7 dos tipos (strings `0/1` separadas por `/`) e das abas — copiar
verbatim para `components/pixel-icon.js` no Task 2:

```
NRM 0011100/0100010/1000001/1000001/1000001/0100010/0011100
FIR 0010100/0011100/0111010/0111110/1111111/1101111/0111110
WTR 0001000/0011100/0011100/0111110/1111111/1111111/0111110
ELC 0000110/0001100/0011000/0111110/0001100/0011000/0110000
GRS 0000111/0001111/0011110/0111100/1111000/0110100/1100010
ICE 1001001/0101010/0011100/1111111/0011100/0101010/1001001
FGT 0000000/0110110/1111111/1111111/1111111/0111110/0011100
PSN 0111110/1111111/1011101/1111111/0111110/0010100/0101010
GRD 0000000/0001000/0011100/0111110/1111111/0000000/1111111
FLY 0000000/1100000/1111000/0111110/0011111/0000110/0000000
PSY 0000000/0111110/1000001/1001101/1000001/0111110/0000000
BUG 1000001/0100010/0111110/1111111/0111110/1111111/0100010
RCK 0001100/0011110/0111111/1111111/1111110/0111100/0000000
GHO 0011100/0111110/1101011/1111111/1111111/1111111/1010101
DRG 0001000/0011100/0111110/1111111/0111110/0011100/0001000
DRK 0011100/0111110/1111000/1110000/1111000/0111110/0011100
STL 0011100/0111110/1110111/1100011/1110111/0111110/0011100
FRY 0001000/0001000/0101010/0011100/1110111/0011100/0101010

enc  0001000/0011100/0110110/1110111/0110110/0011100/0001000
calc 1111111/1000001/1011101/1000001/1010101/1010101/1111111
tbl  1111111/1001001/1111111/1001001/1111111/1001001/1111111
team 0011100/0100010/1111111/1000001/1010101/1000001/1111111
cfg  0101010/1111111/1110111/1100011/1110111/1111111/0101010
```

---

### Task 1: Design system base — fontes + tokens em `pixel-theme.css`

**Files:**
- Modify: `pixel-theme.css` (adicionar; NÃO remover o que existe — limpeza é no Task 9)

**Interfaces:**
- Produces: variáveis CSS `--px-*` e `--t-*` (tabela acima); `@font-face` de `Pixelify Sans` (400–700, variável) e `Silkscreen` (400 e 700); classes `.px-label`, `.px-rule`, `.px-btn`, `.px-btn.active`, `.px-toggle`, `.px-bar`, `.px-bar-fill`, `.px-input`, `.mult-4/.mult-2/.mult-1/.mult-0-5/.mult-0-25/.mult-0`, `.px-blip`, keyframes `px-blip`. Todas as tasks seguintes consomem isso.

- [ ] **Step 1: Criar o branch**

```bash
git checkout develop && git checkout -b feat/novo-layout-pixel
```

- [ ] **Step 2: Gerar o CSS das fontes (data-URI)**

```bash
S=/tmp/claude-1000/-home-ndr-server-projects-pokemon-helpers/24acb54d-4067-4dbb-aeaa-b09b8096bc00/scratchpad
node -e '
const fs = require("fs");
const S = process.env.S;
const b64 = f => fs.readFileSync(S + "/" + f).toString("base64");
const face = (family, weight, file) =>
`@font-face {
    font-family: ${JSON.stringify(family)};
    font-style: normal;
    font-weight: ${weight};
    font-display: swap;
    src: url("data:font/woff2;charset=utf-8;base64,${b64(file)}") format("woff2");
}`;
fs.writeFileSync(S + "/fonts-css.txt", [
  face("Pixelify Sans", "400 700", "pixelify-sans-latin.woff2"),
  face("Silkscreen", "400", "silkscreen-400-latin.woff2"),
  face("Silkscreen", "700", "silkscreen-700-latin.woff2"),
].join("\n\n") + "\n");
console.log("ok:", fs.statSync(S + "/fonts-css.txt").size, "bytes");
'
```

Se os `.woff2` não existirem mais no scratchpad, reextrair do bundle antes:

```bash
node -e '
const fs = require("fs"), zlib = require("zlib");
const html = fs.readFileSync("/home/ndr-server/Downloads/Extensao Painel (standalone) (1).html", "utf8");
const manifest = JSON.parse(html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const S = process.env.S;
// latin subsets: Pixelify 49d7f9ca…, Silkscreen 400 9ae697fc…, Silkscreen 700 26e1b3b5…
const map = { "49d7f9ca": "pixelify-sans-latin.woff2", "9ae697fc": "silkscreen-400-latin.woff2", "26e1b3b5": "silkscreen-700-latin.woff2" };
for (const [k, v] of Object.entries(manifest)) {
  const short = k.slice(0, 8);
  if (!map[short]) continue;
  const raw = Buffer.from(v.data, "base64");
  fs.writeFileSync(S + "/" + map[short], v.compressed ? zlib.gunzipSync(raw) : raw);
}
'
```

- [ ] **Step 3: Adicionar fontes + tokens + classes novas ao `pixel-theme.css`**

No TOPO do arquivo (antes do `@font-face` do Press Start 2P, que fica até o
Task 9), colar o conteúdo de `$S/fonts-css.txt` e, em seguida, este bloco
(os hex vêm das tabelas "Paleta e dados de referência" acima — preencher
todas as variáveis listadas lá):

```css
/* ---------------------------------------------------------------------
   Design system v2 (mockup 2026-08): tokens px-*, tipos, multiplicadores.
   Fontes: Pixelify Sans (corpo) e Silkscreen (labels/números).
--------------------------------------------------------------------- */
:root {
    --px-bg-bar: #08080d;
    --px-bg: #0d0d14;
    --px-bg-card: #11111a;
    --px-bg-btn: #12121b;
    --px-bg-cell: #14141d;
    --px-bg-btn2: #16161f;
    --px-bg-track: #1a1a24;
    --px-bg-badge: #2a2a36;
    --px-line: #1c1c26;
    --px-border: #23232f;
    --px-border-btn: #2b2b39;
    --px-border-tip: #3a3a4c;
    --px-text-hi: #ffffff;
    --px-text: #e6e6f0;
    --px-text-val: #c8c8dc;
    --px-text-soft: #a8a8c0;
    --px-text-dim: #8a8aa0;
    --px-on-dark: #0c0c11;
    --px-accent: #ffb545;
    --px-accent-hover: #ffd08a;
    --px-good: #63bb5b;
    --px-bad: #ea6f83;
    --px-female: #f56a8a;
    --px-male: #4a90e2;
    --px-mid: #d9a642;
    --px-best-border: #4a3a12;
    --px-font-body: 'Pixelify Sans', monospace;
    --px-font-mono: 'Silkscreen', monospace;
}

.px-label {
    font-family: var(--px-font-mono);
    font-size: 10px;
    color: var(--px-text-dim);
    letter-spacing: 1.5px;
    text-transform: uppercase;
}
.px-rule { display: flex; align-items: center; gap: 7px; }
.px-rule::after { content: ''; flex: 1; height: 1px; background: var(--px-line); }

.px-btn {
    font-family: var(--px-font-mono);
    font-size: 11px;
    background: var(--px-bg-btn2);
    border: 1px solid var(--px-border-btn);
    color: var(--px-text-dim);
    border-radius: 0;
    padding: 5px 10px;
    cursor: pointer;
}
.px-btn.active { background: var(--px-accent); border-color: var(--px-accent); color: var(--px-on-dark); }
.px-btn.px-btn-accent { color: var(--px-accent); }

.px-toggle {
    width: 40px; height: 22px;
    border: 1px solid var(--px-border-btn);
    background: var(--px-bg-btn2);
    padding: 0; display: flex; align-items: center; justify-content: flex-start;
    cursor: pointer;
}
.px-toggle::after { content: ''; width: 16px; height: 16px; margin: 0 2px; background: var(--px-text-dim); }
.px-toggle[aria-checked="true"] { background: #3f8f5a; justify-content: flex-end; }
.px-toggle[aria-checked="true"]::after { background: var(--px-on-dark); }

.px-bar { height: 5px; background: var(--px-bg-track); }
.px-bar-fill { height: 100%; }

.px-input {
    background: var(--px-bg-card);
    border: 1px solid var(--px-border);
    color: var(--px-text);
    font-family: var(--px-font-body);
    font-size: 15px;
    padding: 6px 8px;
    border-radius: 0;
    outline: none;
}

.mult-4 { background: #2f9e5e; color: #0c0c11; }
.mult-2 { background: #3f8f5a; color: #0c0c11; }
.mult-1 { background: #2a2a36; color: #a8a8c0; }
.mult-0-5 { background: #8a4550; color: #ffe0e4; }
.mult-0-25 { background: #6e3540; color: #ffe0e4; }
.mult-0 { background: #3a3a4c; color: #cfcfe0; }

@keyframes px-blip { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
.px-blip { width: 6px; height: 6px; background: var(--px-good); animation: px-blip 1.6s steps(2, end) infinite; }

.px-scroll::-webkit-scrollbar { width: 7px; height: 7px; }
.px-scroll::-webkit-scrollbar-track { background: var(--px-bg); }
.px-scroll::-webkit-scrollbar-thumb { background: #2e2e3c; }
```

E atualizar os valores das variáveis `--t-*` já existentes no `:root` do
`pixel-theme.css` para a nova paleta de tipos (tabela acima). Os `:root` locais
de `index.html` e `chart.html` ainda têm cópias antigas — eles serão trocados
nas tasks das telas; não mexer neles agora.

- [ ] **Step 4: Verificar**

```bash
python3 -c "import re,sys; css=open('pixel-theme.css').read(); assert css.count('@font-face')>=4, 'faltam font-faces'; assert '--px-accent' in css and '--t-fire: #f0803c' in css.replace('F0803C','f0803c'), 'tokens ausentes'; print('ok')"
```

Carregar a extensão unpacked e conferir que as telas atuais continuam
renderizando (nada consome as classes novas ainda; não pode haver regressão).

- [ ] **Step 5: Commit**

```bash
git add pixel-theme.css
git commit -m "feat: design system v2 no pixel-theme (fontes Pixelify/Silkscreen, tokens px-*, nova paleta de tipos)"
```

---

### Task 2: `components/pixel-icon.js` + type-tag com ícone pixel

**Files:**
- Create: `components/pixel-icon.js`
- Modify: `components/type-tag.js` (funções `typeIconHTML` e `typeTagHTML`)
- Modify: `components/type-tag.css` (reescrever o visual da pill)
- Modify (só ordem de `<script>`): `index.html`, `battle.html`, `chart.html`, `myPokemons.html`

**Interfaces:**
- Consumes: `ABBR`, `LABELS`, `TYPES` de `components/type-tag.js`; variáveis `--t-*` do Task 1.
- Produces: global `PokemonPixelIcons` com:
  - `TYPE_ICONS: { NRM: '0011100/…', … }` (18 entradas, bitmaps acima)
  - `UI_ICONS: { enc, calc, tbl, team, cfg }` (bitmaps acima)
  - `px(map, color, scale) -> string` (valor de `box-shadow`)
  - `iconHTML(map, color, scale=2) -> string` (span 14×14 com o box-shadow)
  - `typeIcon(typeKey, color) -> string` (typeKey em inglês, ex.: `'fire'`)
  - `onColor(hexBg) -> '#0c0c11' | '#f4f4fa'` (contraste WCAG)
  - `typeColor(typeKey) -> string` (hex da paleta, mesmo valor dos `--t-*`)
  - `mix(hex, base, amount) -> string`

- [ ] **Step 1: Criar `components/pixel-icon.js`**

```js
// ---------------------------------------------------------------------------
// Ícones pixel-art 7×7 do design system: cada glifo é um bitmap de '0'/'1'
// renderizado como box-shadow de um quadrado 2×2 dentro de uma âncora 14×14.
// Também centraliza o contraste automático de texto sobre cores de tipo.
// ---------------------------------------------------------------------------
var PokemonPixelIcons = globalThis.PokemonPixelIcons || (() => {
    const TYPE_ICONS = {
        NRM: '0011100/0100010/1000001/1000001/1000001/0100010/0011100',
        FIR: '0010100/0011100/0111010/0111110/1111111/1101111/0111110',
        WTR: '0001000/0011100/0011100/0111110/1111111/1111111/0111110',
        ELC: '0000110/0001100/0011000/0111110/0001100/0011000/0110000',
        GRS: '0000111/0001111/0011110/0111100/1111000/0110100/1100010',
        ICE: '1001001/0101010/0011100/1111111/0011100/0101010/1001001',
        FGT: '0000000/0110110/1111111/1111111/1111111/0111110/0011100',
        PSN: '0111110/1111111/1011101/1111111/0111110/0010100/0101010',
        GRD: '0000000/0001000/0011100/0111110/1111111/0000000/1111111',
        FLY: '0000000/1100000/1111000/0111110/0011111/0000110/0000000',
        PSY: '0000000/0111110/1000001/1001101/1000001/0111110/0000000',
        BUG: '1000001/0100010/0111110/1111111/0111110/1111111/0100010',
        RCK: '0001100/0011110/0111111/1111111/1111110/0111100/0000000',
        GHO: '0011100/0111110/1101011/1111111/1111111/1111111/1010101',
        DRG: '0001000/0011100/0111110/1111111/0111110/0011100/0001000',
        DRK: '0011100/0111110/1111000/1110000/1111000/0111110/0011100',
        STL: '0011100/0111110/1110111/1100011/1110111/0111110/0011100',
        FRY: '0001000/0001000/0101010/0011100/1110111/0011100/0101010'
    };
    const UI_ICONS = {
        enc:  '0001000/0011100/0110110/1110111/0110110/0011100/0001000',
        calc: '1111111/1000001/1011101/1000001/1010101/1010101/1111111',
        tbl:  '1111111/1001001/1111111/1001001/1111111/1001001/1111111',
        team: '0011100/0100010/1111111/1000001/1010101/1000001/1111111',
        cfg:  '0101010/1111111/1110111/1100011/1110111/1111111/0101010'
    };
    const TYPE_COLORS = {
        normal: '#9a9a80', fire: '#f0803c', water: '#4a90e2', electric: '#f5cd35',
        grass: '#63bb5b', ice: '#7fd6d6', fighting: '#d3425f', poison: '#b763cf',
        ground: '#d9a642', flying: '#8f7fe0', psychic: '#f56a8a', bug: '#92bc2c',
        rock: '#c9b787', ghost: '#7b62a3', dragon: '#5f6fe8', dark: '#6f6880',
        steel: '#8fa5b8', fairy: '#ee90c0'
    };

    function px(map, color, scale) {
        const out = [];
        map.split('/').forEach((rowBits, y) => rowBits.split('').forEach((bit, x) => {
            if (bit === '1') out.push(`${x * scale}px ${y * scale}px 0 0 ${color}`);
        }));
        return out.join(',');
    }

    function iconHTML(map, color, scale = 2) {
        const size = 7 * scale;
        return `<span class="px-icon" style="position:relative;display:inline-block;width:${size}px;height:${size}px;flex:0 0 auto;">` +
            `<span style="position:absolute;left:0;top:0;width:${scale}px;height:${scale}px;box-shadow:${px(map, color, scale)};"></span>` +
            `</span>`;
    }

    function lum(hex) {
        const channel = (i) => {
            const c = parseInt(hex.slice(i, i + 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
    }
    function ratio(a, b) {
        const x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function onColor(bg) {
        return ratio('#0c0c11', bg) >= ratio('#f4f4fa', bg) ? '#0c0c11' : '#f4f4fa';
    }
    function mix(hex, base, amount) {
        const part = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
        const a = part(hex), b = part(base);
        return '#' + a.map((v, i) => Math.round(b[i] + (v - b[i]) * amount).toString(16).padStart(2, '0')).join('');
    }

    function typeIcon(typeKey, color) {
        // ABBR vem de components/type-tag.js (carregado antes deste arquivo? não:
        // este arquivo não depende da ordem — usa o próprio mapa de abreviações)
        const ab = ({ normal:'NRM', fire:'FIR', water:'WTR', electric:'ELC', grass:'GRS',
            ice:'ICE', fighting:'FGT', poison:'PSN', ground:'GRD', flying:'FLY',
            psychic:'PSY', bug:'BUG', rock:'RCK', ghost:'GHO', dragon:'DRG',
            dark:'DRK', steel:'STL', fairy:'FRY' })[typeKey] || typeKey;
        return iconHTML(TYPE_ICONS[ab] || TYPE_ICONS.NRM, color);
    }

    return Object.freeze({
        TYPE_ICONS, UI_ICONS, px, iconHTML, typeIcon, onColor, mix,
        typeColor: (typeKey) => TYPE_COLORS[typeKey] || '#9a9a80'
    });
})();
globalThis.PokemonPixelIcons = PokemonPixelIcons;
```

- [ ] **Step 2: `node --check components/pixel-icon.js`** — deve passar sem erro.

- [ ] **Step 3: Reescrever `typeIconHTML` e `typeTagHTML` em `components/type-tag.js`**

Substituir as duas funções (mantendo nomes, parâmetros e o resto do arquivo):

```js
// opts.colored mantido por compatibilidade (ignorado — o ícone pixel herda a cor)
function typeIconHTML(type, opts = {}) {
    const bg = PokemonPixelIcons.typeColor(type);
    const color = opts.color || (opts.onType ? PokemonPixelIcons.onColor(bg) : bg);
    const title = opts.title ? ` title="${LABELS[type]}"` : '';
    return `<span class="type-icon-px"${title}>${PokemonPixelIcons.typeIcon(type, color)}</span>`;
}

// pill do design system v2: fundo na cor do tipo, ícone pixel + abreviação em
// Silkscreen, texto na cor de maior contraste. Dois tipos = gradiente 50/50
// com os dois ícones/abreviações (contraste calculado pela cor do 1º tipo).
function typeTagHTML(types, opts = {}) {
    if (!Array.isArray(types)) types = [types];
    const stacked = !!opts.stack;
    const dict = ABBR; // v2 sempre abrevia (o nome completo vive no tooltip)
    const cls = `type-tag${stacked ? ' mini' : ''}`;
    const background = types.length === 2
        ? `linear-gradient(135deg, var(--t-${types[0]}) 50%, var(--t-${types[1]}) 50%)`
        : `var(--t-${types[0]})`;
    const fg = PokemonPixelIcons.onColor(PokemonPixelIcons.typeColor(types[0]));
    const title = opts.title ?? types.map((type) => LABELS[type]).join(' / ');
    const icons = types.map((type) => PokemonPixelIcons.typeIcon(type, fg)).join('');
    const label = opts.label ?? types.map((type) => dict[type]).join('/');
    return `<span class="${cls}" style="background:${background};color:${fg}" data-tip="${title}">` +
        `${icons}<span class="abbr">${label}</span>` +
        `</span>`;
}
```

Nota: `data-tip` substitui `title` — o tooltip global (Task 3) cuida da exibição;
como fallback antes do Task 3 não há tooltip, aceitável dentro do branch.

- [ ] **Step 4: Reescrever `components/type-tag.css`**

```css
/* pill de tipo do design system v2: retangular, ícone pixel + abreviação */
.type-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 7px;
    border-radius: 0;
    font-family: var(--px-font-mono);
    font-size: 10px;
    letter-spacing: .5px;
    line-height: 1;
    white-space: nowrap;
}
.type-tag.mini { padding: 2px 5px; font-size: 9px; gap: 4px; }
.type-tag .abbr { font-family: var(--px-font-mono); }
.type-icon-px { display: inline-flex; }
```

- [ ] **Step 5: Carregar `pixel-icon.js` antes de `type-tag.js` nas 4 páginas**

Em `index.html`, `battle.html`, `chart.html`, `myPokemons.html`, adicionar
imediatamente ANTES do `<script src="components/type-tag.js"></script>`:

```html
<script src="components/pixel-icon.js"></script>
```

- [ ] **Step 6: Verificar**

`node --check` nos dois JS alterados. Carregar a extensão unpacked: as pills de
tipo nas 4 telas devem aparecer com ícone pixel + abreviação nas cores novas
(o resto do layout ainda é o antigo — esperado).

- [ ] **Step 7: Commit**

```bash
git add components/pixel-icon.js components/type-tag.js components/type-tag.css index.html battle.html chart.html myPokemons.html
git commit -m "feat: ícones pixel 7×7 e type-tag no design system v2"
```

---

### Task 3: Tooltip global + preferência `tooltipsEnabled`

**Files:**
- Modify: `data/extension-storage.js`
- Create: `components/tooltip.js`
- Modify (adicionar `<script>`): `index.html`, `battle.html`, `chart.html`, `myPokemons.html`

**Interfaces:**
- Consumes: `PokemonHelperStorage.read/write` (padrão interno do módulo); tokens CSS do Task 1 (o componente injeta o próprio `<style>`, então funciona também no shell sem `pixel-theme.css` explícito — usa hex literais).
- Produces:
  - `PokemonHelperStorage.getUiPreferences() -> Promise<{tooltipsEnabled: boolean}>`
  - `PokemonHelperStorage.setUiPreferences(changes) -> Promise`
  - `PokemonHelperStorage.KEYS.uiPreferences === 'pkmnHelperUiPreferences'`
  - `PokemonHelperTooltip.attach(doc)` — ativa tooltips por delegação para todo elemento com `data-tip` dentro de `doc` (idempotente por documento).

- [ ] **Step 1: Adicionar a chave em `data/extension-storage.js`**

No objeto `KEYS`, adicionar `uiPreferences: 'pkmnHelperUiPreferences'`.
Após `DEFAULT_UPDATE_STATUS`, adicionar:

```js
    const DEFAULT_UI_PREFERENCES = Object.freeze({
        tooltipsEnabled: true
    });
```

No `return Object.freeze({...})`, adicionar:

```js
        DEFAULT_UI_PREFERENCES,
        getUiPreferences: () => read(KEYS.uiPreferences, DEFAULT_UI_PREFERENCES),
        setUiPreferences: (changes) => update(KEYS.uiPreferences, DEFAULT_UI_PREFERENCES, changes),
```

- [ ] **Step 2: Criar `components/tooltip.js`**

```js
// ---------------------------------------------------------------------------
// Tooltip global do design system v2: caixa fixa exibida abaixo de qualquer
// elemento com data-tip, por delegação de eventos. Respeita a preferência
// tooltipsEnabled (Configurações) e reage a mudanças dela em tempo real.
// Injeta o próprio <style> pra funcionar tanto nos iframes quanto no shell.
// ---------------------------------------------------------------------------
var PokemonHelperTooltip = globalThis.PokemonHelperTooltip || (() => {
    let enabled = true;

    PokemonHelperStorage.getUiPreferences()
        .then((preferences) => { enabled = preferences.tooltipsEnabled; })
        .catch(() => {});
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[PokemonHelperStorage.KEYS.uiPreferences]) return;
            enabled = changes[PokemonHelperStorage.KEYS.uiPreferences].newValue?.tooltipsEnabled !== false;
        });
    }

    function ensureBox(doc) {
        let box = doc.getElementById('px-tooltip');
        if (box) return box;
        const style = doc.createElement('style');
        style.textContent = `
            #px-tooltip {
                position: fixed; z-index: 2147483647; max-width: 260px;
                padding: 6px 9px; background: #08080d; border: 1px solid #3a3a4c;
                box-shadow: 2px 2px 0 rgba(0,0,0,.5);
                font-family: 'Pixelify Sans', monospace; font-size: 15px; line-height: 1.35;
                color: #e6e6f0; pointer-events: none; display: none;
            }`;
        doc.head.appendChild(style);
        box = doc.createElement('div');
        box.id = 'px-tooltip';
        doc.body.appendChild(box);
        return box;
    }

    function attach(doc) {
        if (doc.__pxTooltipAttached) return;
        doc.__pxTooltipAttached = true;
        const win = doc.defaultView;
        doc.addEventListener('mouseover', (event) => {
            const target = event.target.closest && event.target.closest('[data-tip]');
            if (!target || !enabled) return;
            const text = target.getAttribute('data-tip');
            if (!text) return;
            const box = ensureBox(doc);
            const rect = target.getBoundingClientRect();
            box.textContent = text;
            box.style.left = `${Math.max(4, Math.min(rect.left, win.innerWidth - 280))}px`;
            box.style.top = `${rect.bottom + 5}px`;
            box.style.display = 'block';
        });
        doc.addEventListener('mouseout', (event) => {
            if (event.target.closest && event.target.closest('[data-tip]')) {
                const box = doc.getElementById('px-tooltip');
                if (box) box.style.display = 'none';
            }
        });
    }

    return Object.freeze({ attach });
})();
globalThis.PokemonHelperTooltip = PokemonHelperTooltip;
```

- [ ] **Step 3: Ativar nas 4 páginas**

Em cada uma (`index.html`, `battle.html`, `chart.html`, `myPokemons.html`),
depois de `data/extension-storage.js`, adicionar:

```html
<script src="components/tooltip.js"></script>
<script>PokemonHelperTooltip.attach(document);</script>
```

- [ ] **Step 4: Verificar**

`node --check` nos JS. Extensão unpacked: passar o mouse numa pill de tipo →
caixa de tooltip aparece abaixo, com o nome do tipo.

- [ ] **Step 5: Commit**

```bash
git add data/extension-storage.js components/tooltip.js index.html battle.html chart.html myPokemons.html
git commit -m "feat: tooltip global com preferência tooltipsEnabled"
```

---

### Task 4: Shell — barra de abas pixel, status bar, atalhos, modo full, config

**Files:**
- Modify: `content.js` (estilos injetados, header, settings panel, modo full, atalhos, status bar)
- Modify: `components/header-buttons.js` (botões com ícone pixel)

**Interfaces:**
- Consumes: `PokemonPixelIcons.iconHTML/UI_ICONS`, `PokemonHelperTooltip.attach`, `PokemonHelperStorage.getUiPreferences/setUiPreferences`. `content.js` já roda com `components/header-buttons.js`, `data/extension-storage.js` injetados pelo `background.js` — verificar em `background.js` a lista de scripts injetados e ACRESCENTAR `components/pixel-icon.js` e `components/tooltip.js` a ela (antes de `content.js`).
- Produces (consumido pelas tasks 5–8):
  - mensagem `{ type: 'panel-mode', full: boolean }` postada a cada iframe ao alternar o modo full e no carregamento;
  - tratamento das mensagens vindas dos iframes: `{ type: 'panel-exit-full' }` (sai do full) e `{ type: 'panel-shortcut', key: string }` (roteia atalho).

- [ ] **Step 1: Reescrever `buildHeaderButtons` em `components/header-buttons.js`**

```js
// ---------------------------------------------------------------------------
// Barra de abas do overlay (content.js): botões 30×26 com ícone pixel 7×7
// (encontro / calculadora / meus pokémons / config) + expandir + minimizar.
// ---------------------------------------------------------------------------

// items: [{ icon: chave de PokemonPixelIcons.UI_ICONS, tip, view }]
function buildHeaderButtons(header, items, collapseItem, maximizeItem = { tip: 'Expandir — F' }) {
    const iconSpan = (name, color) => PokemonPixelIcons.iconHTML(PokemonPixelIcons.UI_ICONS[name], color);

    items.forEach((item) => {
        const btn = document.createElement('button');
        btn.className = 'ph-icon-btn ph-view-btn';
        btn.dataset.view = item.view;
        btn.dataset.icon = item.icon;
        btn.dataset.tip = item.tip;
        btn.innerHTML = iconSpan(item.icon, '#7a7a92');
        header.appendChild(btn);
    });

    const spacer = document.createElement('div');
    spacer.className = 'ph-spacer';
    header.appendChild(spacer);

    const maximizeBtn = document.createElement('button');
    maximizeBtn.className = 'ph-icon-btn ph-maximize-btn';
    maximizeBtn.dataset.tip = maximizeItem.tip;
    maximizeBtn.innerHTML = iconSpan('tbl', '#7a7a92');
    header.appendChild(maximizeBtn);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'ph-icon-btn ph-collapse-btn';
    collapseBtn.dataset.tip = collapseItem.tip;
    collapseBtn.textContent = '_';
    header.appendChild(collapseBtn);

    return { collapseBtn, maximizeBtn };
}

// repinta os ícones conforme a view ativa (chamado por setActiveView)
function paintHeaderButtons(container, activeView) {
    container.querySelectorAll('.ph-view-btn').forEach((btn) => {
        const active = btn.dataset.view === activeView;
        btn.classList.toggle('active', active);
        btn.innerHTML = PokemonPixelIcons.iconHTML(
            PokemonPixelIcons.UI_ICONS[btn.dataset.icon],
            active ? '#0c0c11' : '#7a7a92'
        );
    });
}
```

- [ ] **Step 2: Atualizar a chamada em `content.js` (linhas ~69–75)**

```js
        const { collapseBtn, maximizeBtn } = buildHeaderButtons(header, [
            { icon: 'enc', tip: 'Encontro atual — tecla E', view: 'battle' },
            { icon: 'calc', tip: 'Calculadora de tipos — tecla C', view: 'calc' },
            { icon: 'team', tip: 'Meus Pokémon — tecla M', view: 'myPokemons' },
            { icon: 'cfg', tip: 'Configurações — vírgula', view: 'settings' },
        ], { tip: 'Minimizar — Esc' });
```

A view `chart` sai da barra (fica acessível pelo modo full), mas continua uma
view válida: se `settings.view === 'chart'` vier do storage, `setActiveView`
segue funcionando.

- [ ] **Step 3: Reescrever o bloco de estilo injetado (`injectStyle`)**

Substituir o conteúdo de `style.textContent` mantendo os mesmos seletores
estruturais (`.ph-bubble`, `.collapsed`, `.ph-header`, `.ph-body`, `.ph-frame`,
`.ph-settings`, `.ph-resize-*`) e re-skinnando:

```css
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
#${ID}.full-side #pokemon-chart-frame { display: block; flex: 1 1 auto; min-width: 0; }
#${ID}.full-side .ph-frame.side-active { display: block; flex: 0 0 var(--ph-side-width, 360px); border-left: 2px solid #23232f; }
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
```

Manter as regras de `.ph-bubble`, `.collapsed`, `.ph-resize-*` como estão
(trocando apenas as cores `#9198ab`→`#8a8aa0`, gradientes dos cantos idem) e as
regras de `.ph-settings` (que serão substituídas no Step 6).

- [ ] **Step 4: Status bar + modo full em `content.js`**

Em `build()`, depois de `container.appendChild(body)`:

```js
        const statusBar = document.createElement('div');
        statusBar.className = 'ph-status';
        statusBar.innerHTML = '<div class="ph-status-dot"></div><div class="ph-status-text"></div>';
        container.appendChild(statusBar);
```

Nova função (perto de `applyBox`):

```js
    let dataSeen = false;
    function updateStatus(container, settings) {
        const text = container.querySelector('.ph-status-text');
        if (!text) return;
        const mode = settings.maximized ? 'EXPANDIDO' : `ENCAIXADO ${settings.width}PX`;
        text.textContent = `${dataSeen ? 'CONECTADO' : 'AGUARDANDO DADOS'} · ${mode} · F=EXPANDIR  ESC=MINIMIZAR`;
    }
```

Chamar `updateStatus(container, settings)` no fim de `build()`, dentro do
listener do `maximizeBtn`, e marcar `dataSeen = true` no início de
`handleHelperPayload` (seguido de `updateStatus(overlay, currentSettings(overlay))`).

Modo full lado a lado — no listener existente do `maximizeBtn` e em
`setActiveView`, sincronizar a classe:

```js
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
        container.querySelectorAll('.ph-frame').forEach((frame) => {
            frame.contentWindow?.postMessage({ type: 'panel-mode', full: settings.maximized === true }, '*');
        });
    }
```

Chamar `syncFullSide(container, settings)` ao final do listener do
`maximizeBtn` e dentro de `setActiveView` (esta última lê as settings via
`currentSettings(container)`). Em `setActiveView`, quando o modo lado a lado
está ativo, o frame ativo não pode ser escondido pelo `display:none` do laço
atual — ajustar o laço para pular frames com `classList.contains('side-active')`
e o `#pokemon-chart-frame` quando `container.classList.contains('full-side')`.
Trocar também `btn.classList.toggle('active', ...)` pelo novo
`paintHeaderButtons(container, view)`.

- [ ] **Step 5: Atalhos de teclado + mensagens dos iframes em `content.js`**

Dentro de `build()`:

```js
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
```

E ativar o tooltip no documento do jogo para os botões do header:
`PokemonHelperTooltip.attach(document);` no fim de `build()`.

- [ ] **Step 6: Painel de configurações (cfg) — largura, toggles, atalhos**

Reescrever `buildSettingsPanel()` com o layout novo (mantendo listeners de
update/beta e o botão de atalho do navegador):

```js
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
        // [manter daqui pra baixo os listeners existentes de ph-set-shortcut,
        //  ph-update-notifications e ph-beta-channel exatamente como estão hoje]
```

Acrescentar no fim de `buildSettingsPanel()` (antes do `return panel`):

```js
        const widthValue = panel.querySelector('#ph-width-value');
        function applyWidth(delta) {
            const container = document.getElementById(ID);
            if (!container) return;
            const settings = currentSettings(container);
            settings.width = clampNum(settings.width + delta, 250, 380, settings.width);
            widthValue.textContent = `${settings.width}px`;
            applyBox(container, settings);
            updateStatus(container, settings);
            persist(settings);
        }
        panel.querySelector('#ph-width-minus').addEventListener('click', () => applyWidth(-20));
        panel.querySelector('#ph-width-plus').addEventListener('click', () => applyWidth(20));
        widthValue.textContent = '—';
        setTimeout(() => { // preenche após o container existir
            const container = document.getElementById(ID);
            if (container) widthValue.textContent = `${currentSettings(container).width}px`;
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
```

CSS correspondente no bloco injetado (substituindo as regras `.ph-settings*` e
`.ph-toggle*` atuais):

```css
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
```

- [ ] **Step 7: Injeção de scripts em `background.js`**

Localizar em `background.js` a lista de arquivos injetados junto com
`content.js` (buscar por `content.js`) e acrescentar
`components/pixel-icon.js` e `components/tooltip.js` ANTES de `content.js`
em todas as ocorrências (clique, atalho e injeção automática).

- [ ] **Step 8: Verificar**

`node --check content.js components/header-buttons.js background.js`.
Extensão unpacked: barra de abas com 4 ícones pixel + expandir + `_`; aba ativa
âmbar; barra de status embaixo com dot piscando; `F` (com o painel focado)
expande com a tabela ao lado; `Esc` minimiza; config mostra largura −/+,
3 toggles e a lista de atalhos; tooltips nos botões do header.

- [ ] **Step 9: Commit**

```bash
git add content.js components/header-buttons.js background.js
git commit -m "feat: shell do painel no design v2 (abas pixel, status bar, atalhos, modo full, config)"
```

---

### Task 5: Tela de Encontro (`battle.html` + `battle.js`)

**Files:**
- Modify: `battle.html` (bloco `<style>` e corpo)
- Modify: `battle.js` (funções de render; a camada de dados/estado NÃO muda)

**Interfaces:**
- Consumes: tokens do Task 1, `typeTagHTML`/`PokemonPixelIcons` do Task 2, tooltip do Task 3; funções existentes `recommend`-data, `resolveFoeMoves`, `defMultiplier`, `multLabel`, `PokemonIvEvaluation`, `PokemonCatchRate`, `natureEffectHTML`, `PokemonAbilityInfo`.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Reescrever o `<style>` de `battle.html`**

Substituir o bloco inteiro por estilos do design v2 (remover as regras do modal
de matchup, `.recommendation`, `.info-icon`, `.row`, `.move-*`):

```css
* { box-sizing: border-box; }
body {
    margin: 0; background: var(--px-bg); color: var(--px-text);
    font-family: var(--px-font-body); font-size: 15px;
    padding: 9px 10px 14px;
}
.enc-screen { display: flex; flex-direction: column; gap: 10px; }
.enc-head { display: flex; align-items: flex-start; gap: 9px; }
.enc-sprite {
    width: 60px; height: 60px; flex: 0 0 auto;
    background: repeating-linear-gradient(45deg, #1a1a24 0 4px, #15151e 4px 8px);
    box-shadow: inset 0 0 0 1px var(--px-border);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--px-font-mono); font-size: 7px; color: #4a4a5c;
}
.enc-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.enc-name-row { display: flex; align-items: baseline; gap: 6px; }
.enc-name { font-family: var(--px-font-mono); font-size: 15px; font-weight: 700; color: var(--px-text-hi); letter-spacing: .5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }
.enc-level { font-size: 16px; color: var(--px-text-dim); white-space: nowrap; }
.enc-gender-f { color: var(--px-female); font-size: 17px; }
.enc-gender-m { color: var(--px-male); font-size: 17px; }
.enc-types { display: flex; gap: 4px; }
.enc-hp { display: flex; align-items: center; gap: 7px; }
.enc-hp-track { flex: 1; height: 10px; background: var(--px-bg-track); box-shadow: inset 0 0 0 1px #26263a; position: relative; overflow: hidden; }
.enc-hp-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--px-good); }
.enc-hp-fill[data-level="mid"] { background: var(--px-mid); }
.enc-hp-fill[data-level="low"] { background: var(--px-bad); }
.enc-hp-label { font-family: var(--px-font-mono); font-size: 10px; color: var(--px-text-dim); }
.meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--px-line); border: 1px solid var(--px-line); }
.meta-cell { background: var(--px-bg-card); padding: 5px 7px; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.meta-key { font-family: var(--px-font-mono); font-size: 8px; color: var(--px-text-dim); letter-spacing: .5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta-val { font-size: 15px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--px-text-val); }
.section { display: flex; flex-direction: column; gap: 5px; }
.section-head { display: flex; align-items: center; gap: 7px; }
.section-head .px-label { white-space: nowrap; }
.section-head::after { content: ''; flex: 1; height: 1px; background: var(--px-line); }
.section-head .head-extra { font-family: var(--px-font-mono); font-size: 10px; }
.ivs-grid6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.iv-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; background: var(--px-bg-card); padding: 4px 0; }
.iv-key { font-family: var(--px-font-mono); font-size: 11px; color: var(--px-text-soft); }
.iv-cell .px-bar { width: 78%; }
.iv-num { font-family: var(--px-font-mono); font-size: 12px; line-height: 1; }
.iv-stat { font-size: 14px; line-height: 1; color: var(--px-text-val); }
.best-box { border: 1px solid var(--px-best-border); background: linear-gradient(#1b1509, #15110a); padding: 7px 9px; display: flex; flex-direction: column; gap: 6px; }
.best-head { display: flex; align-items: center; gap: 7px; font-family: var(--px-font-mono); font-size: 10px; color: var(--px-accent); letter-spacing: 1.5px; }
.best-head::after { content: ''; flex: 1; height: 1px; background: var(--px-best-border); }
.best-row { display: flex; align-items: center; gap: 7px; }
.best-mon { font-family: var(--px-font-mono); font-size: 11px; color: var(--px-text-hi); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }
.best-detail { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.best-line { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
.best-badges { display: flex; align-items: center; gap: 4px; }
.best-badge { font-family: var(--px-font-mono); font-size: 10px; padding: 3px 6px; }
.badge-neutral { background: var(--px-bg-badge); color: var(--px-text-val); }
.badge-stab { background: var(--px-best-border); color: var(--px-accent); }
.slot-num { width: 16px; height: 16px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.35); font-family: var(--px-font-mono); font-size: 9px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 3px; }
.move-item { background: var(--px-bg-card); display: flex; flex-direction: column; }
.move-main { display: flex; align-items: center; gap: 7px; padding: 5px 7px; }
.move-type-box { width: 26px; height: 26px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
.move-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.move-name { font-size: 15px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.move-sub { font-size: 13px; line-height: 1.1; }
.move-mult { font-family: var(--px-font-mono); font-size: 11px; padding: 3px 5px; }
.move-expand { width: 26px; height: 26px; flex: 0 0 auto; background: var(--px-bg-track); border: 1px solid var(--px-border-btn); color: var(--px-text-val); font-family: var(--px-font-mono); font-size: 11px; padding: 0; cursor: pointer; }
.move-expand.open { background: var(--px-accent); color: var(--px-on-dark); }
.move-detail { display: flex; flex-direction: column; gap: 4px; padding: 0 7px 8px; }
.eff-row { display: flex; align-items: flex-start; gap: 6px; }
.eff-mult { width: 34px; flex: 0 0 auto; font-family: var(--px-font-mono); font-size: 11px; padding: 5px 0; text-align: center; }
.eff-types { flex: 1; display: flex; flex-wrap: wrap; gap: 3px; }
.status-note { font-size: 14px; color: #9a9ab0; }
.rows { display: flex; flex-direction: column; }
.row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px solid var(--px-line); }
.row:last-child { border-bottom: none; }
.row .label { color: var(--px-text-dim); }
.row .value { text-align: right; color: var(--px-text-val); }
.ball-rate { color: var(--px-male); }
.stage.up { color: var(--px-good); }
.stage.down { color: var(--px-bad); }
.gotcha { padding: 12px; text-align: center; }
.gotcha-badge { display: inline-block; padding: 9px 14px; background: var(--px-good); color: var(--px-on-dark); font-family: var(--px-font-mono); }
.empty { color: var(--px-text-dim); }
```

Trocar o `<h2>` fixo do body por nada (o cabeçalho da tela agora é o header do
Pokémon) — manter só `<div id="content">`.

- [ ] **Step 2: Reescrever o render em `battle.js`**

Remover: `matchupModalOpen`, `matchupIncludeDual`, `renderMatchupModal`,
`renderMatchups`, `renderMatchupList`, `matchupValue`, `dualCombos`,
`isDualDefenseException`, `infoIcon`, `hpGauge`, e os dois listeners de
click/change do modal. Adicionar estado de expansão dos golpes:

```js
const openMoves = new Set();
```

Novo helper de nível de IV/cor (substituindo usos de `ivLevel` visualmente):

```js
const ivColor = (iv) => iv >= 26 ? 'var(--px-good)' : iv >= 15 ? 'var(--px-mid)' : 'var(--px-bad)';
```

`recommend(foe)` passa a devolver o candidato (dados), e o render monta a caixa:

```js
function bestPlay(foe) {
    // [mesmo corpo atual de recommend() até candidates.sort(...), com um
    //  ajuste: o forEach interno vira (move, moveIndex) => … e o candidate
    //  ganha o campo moveIndex, pra exibir o slot do golpe]
    const best = candidates[0];
    if (!best) return '';
    const moveType = TYPE_MAPPER[best.move.type];
    const hasStab = typeNames(best.pokemon.types).includes(moveType);
    const typeBg = PokemonPixelIcons.typeColor(moveType);
    const fg = PokemonPixelIcons.onColor(typeBg);
    const multBadge = best.multiplier !== 1
        ? `<span class="best-badge ${multClass(best.multiplier)}" data-tip="${best.multiplier > 1 ? 'Super eficaz' : 'Pouco eficaz'} contra o oponente.">${multLabel(best.multiplier)}</span>`
        : '';
    return `<div class="best-box">
        <div class="best-head" data-tip="Melhor combinação de Pokémon e golpe do seu time contra este oponente (potência × precisão × eficácia × STAB × ataque).">MELHOR JOGADA</div>
        <div class="best-row">
            <div class="best-detail">
                <div class="best-mon">${escapeHtml(best.pokemon.name || best.pokemon.species)} — slot ${best.index + 1}</div>
                <div class="best-line">
                    <span class="type-tag" style="background:${typeBg};color:${fg}" data-tip="${escapeHtml(best.move.name)} está no slot ${best.moveIndex + 1} de golpes">
                        ${PokemonPixelIcons.typeIcon(moveType, fg)}<span class="abbr">${escapeHtml(best.move.name)}</span><span class="slot-num" style="color:${fg}">${best.moveIndex + 1}</span>
                    </span>
                    <span class="best-badges">
                        ${multBadge}
                        <span class="best-badge badge-neutral" data-tip="Potência base do golpe.">POT ${best.move.power}</span>
                        ${hasStab ? '<span class="best-badge badge-stab" data-tip="STAB: +50% de dano porque o golpe é do mesmo tipo do Pokémon.">STAB</span>' : ''}
                    </span>
                </div>
            </div>
        </div>
    </div>`;
}
```

Fraquezas (novo):

```js
function renderWeaknesses(foe) {
    const foeTypes = typeNames(foe.types);
    if (!foeTypes.length) return '';
    const weak = TYPES
        .map((type) => ({ type, value: defMultiplier(type, foeTypes) }))
        .filter((entry) => entry.value > 1)
        .sort((a, b) => b.value - a.value);
    if (!weak.length) return '';
    const chips = weak.map(({ type, value }) =>
        typeTagHTML(type, { title: `${LABELS[type]} causa ${multLabel(value)} de dano nele.` })).join('');
    return `<div class="section">
        <div class="section-head" data-tip="Tipos que causam dano extra nele. Resistências e imunidades ficam de fora."><span class="px-label">FRAQUEZAS DELE</span></div>
        <div class="chip-row">${chips}</div>
    </div>`;
}
```

Golpes do oponente com expansão (substitui `renderFoeMoves`/`renderMoveCard`):

```js
function moveWorstCase(moveType) {
    // pior caso contra o meu time: maior multiplicador desse golpe contra
    // qualquer Pokémon do meu time
    const values = state.party.filter(Boolean).map((pokemon) => defMultiplier(moveType, typeNames(pokemon.types)));
    return values.length ? Math.max(...values) : null;
}

function renderFoeMoves(foe) {
    const resolved = resolveFoeMoves(foe);
    if (!resolved.moves.length) return '';
    const sourceHint = MOVE_SOURCE_LABELS[resolved.source]
        + (resolved.source === 'discovered' && resolved.seenCount < 4 ? ` (${resolved.seenCount}/4 vistos até agora)` : '');
    const items = resolved.moves.map((move) => {
        const isStatus = STATUS_MOVES.has(move.slug);
        const open = openMoves.has(move.slug);
        const typeBg = PokemonPixelIcons.typeColor(move.type);
        const fg = PokemonPixelIcons.onColor(typeBg);
        const worst = isStatus ? null : moveWorstCase(move.type);
        const multChip = worst === null
            ? '<span class="move-mult mult-1">—</span>'
            : `<span class="move-mult ${multClass(worst)}" data-tip="Pior caso contra o seu time.">${multLabel(worst)}</span>`;
        const details = MOVE_DETAILS[move.slug];
        const sub = details
            ? `${MOVE_CATEGORY_LABELS[details.category] || '?'} · ${details.pp ?? '—'} PP`
            : (isStatus ? 'Status' : '');
        let detail = '';
        if (open) {
            const body = isStatus
                ? '<div class="status-note">Golpe de status — não causa dano.</div>'
                : renderEffRows(move.type);
            detail = `<div class="move-detail">${body}</div>`;
        }
        return `<div class="move-item">
            <div class="move-main" data-tip="${escapeHtml(moveTooltip(move.slug))}">
                <span class="move-type-box" style="background:${typeBg}">${PokemonPixelIcons.typeIcon(move.type, fg)}</span>
                <span class="move-info"><span class="move-name">${escapeHtml(moveLabel(move.slug))}</span><span class="move-sub">${sub}</span></span>
                ${multChip}
                <button type="button" class="move-expand${open ? ' open' : ''}" data-action="toggle-move" data-slug="${move.slug}"
                    data-tip="${open ? 'Fechar' : 'Ver'} contra quais tipos ${escapeHtml(moveLabel(move.slug))} é forte ou fraco">${open ? '▾' : '▸'}</button>
            </div>
            ${detail}
        </div>`;
    }).join('');
    return `<div class="section">
        <div class="section-head" data-tip="${escapeHtml(sourceHint)}"><span class="px-label">GOLPES DELE</span></div>
        ${items}
    </div>`;
}

function renderEffRows(moveType) {
    const entries = TYPES.map((type) => ({ combo: [type], value: defMultiplier(moveType, [type]) }));
    const groups = groupByValue(entries).filter(([value]) => value !== 1);
    if (!groups.length) return '<div class="status-note">Sem interação especial.</div>';
    return groups.map(([value, combos]) =>
        `<div class="eff-row"><span class="eff-mult ${multClass(value)}">${multLabel(value)}</span>` +
        `<span class="eff-types">${combos.map((combo) => typeTagHTML(combo, { stack: true })).join('')}</span></div>`
    ).join('');
}
```

Listener novo de expansão (substitui os listeners do modal):

```js
document.getElementById('content').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action="toggle-move"]');
    if (!btn) return;
    const slug = btn.dataset.slug;
    if (openMoves.has(slug)) openMoves.delete(slug); else openMoves.add(slug);
    render();
});
```

E o `render()` principal vira:

```js
function render() {
    const content = document.getElementById('content'), foe = state.foe;
    if (!foe) { content.innerHTML = '<p class="empty">Nenhum encontro capturado ainda. Entre em uma batalha selvagem.</p>'; return; }
    const stats = foe.stats || {}, ivs = foe.ivs || {}, evaluation = PokemonIvEvaluation.evaluate(foe);
    const foeTypes = typeNames(foe.types);
    const hpPct = foe.maxHp > 0 ? Math.max(0, Math.min(100, foe.hp / foe.maxHp * 100)) : 0;
    const hpLevel = hpPct <= 20 ? 'low' : hpPct <= 50 ? 'mid' : 'high';
    const gender = foe.gender === 'female' || foe.gender === 'f' || foe.gender === '♀'
        ? '<span class="enc-gender-f">♀</span>'
        : foe.gender ? '<span class="enc-gender-m">♂</span>' : '';

    const head = `<div class="enc-head">
        <div class="enc-sprite">SPRITE</div>
        <div class="enc-id">
            <div class="enc-name-row">
                <span class="enc-name">${escapeHtml(foe.name || foe.species)}</span>
                <span class="enc-level">Lv${foe.level ?? '-'}</span>${gender}
                ${foe.shiny ? '<span class="best-badge badge-stab" data-tip="Shiny!">★</span>' : ''}
            </div>
            <div class="enc-types">${foeTypes.map((type) => typeTagHTML(type)).join('')}</div>
            <div class="enc-hp">
                <div class="enc-hp-track"><div class="enc-hp-fill" data-level="${hpLevel}" style="width:${hpPct}%"></div></div>
                <span class="enc-hp-label">${Number(foe.hp || 0)}/${Number(foe.maxHp || 0)}</span>
            </div>
        </div>
    </div>`;

    const metaCell = (key, value, tip, color) =>
        `<div class="meta-cell" data-tip="${escapeHtml(tip)}"><span class="meta-key">${key}</span><span class="meta-val"${color ? ` style="color:${color}"` : ''}>${value}</span></div>`;
    const meta = `<div class="meta-grid">
        ${metaCell('HABILIDADE', `<span data-ability="${escapeHtml(foe.ability)}">${escapeHtml(PokemonAbilityInfo.label(foe.ability))}</span>`, 'Habilidade do oponente.')}
        ${metaCell('NATUREZA', natureEffectHTML(foe.nature), 'Natureza e atributos afetados.')}
        ${metaCell('ITEM', escapeHtml(foe.heldItem || '—'), foe.heldItem ? 'Item segurado.' : 'Nenhum item detectado neste encontro.', foe.heldItem ? null : 'var(--px-text-dim)')}
        ${metaCell('ATQ PRINCIPAL', evaluation.role, 'Estimado pelo maior stat ofensivo.')}
        ${metaCell('AVALIAÇÃO', PokemonIvEvaluation.html(foe), 'Avaliação combinando IVs, natureza e stats base.')}
        ${metaCell('IVS TOTAL', `${evaluation.percent}%`, 'Percentual dos IVs em relação ao máximo.', ivColor(evaluation.percent * 31 / 100))}
    </div>`;

    const ivsSection = `<div class="section">
        <div class="section-head"><span class="px-label">IVS / STATS</span><span class="head-extra" style="color:${ivColor(evaluation.percent * 31 / 100)}">${evaluation.percent}%</span></div>
        <div class="ivs-grid6">${STAT_KEYS.filter((key) => ivs[key] !== undefined).map((key) => `
            <div class="iv-cell" data-tip="${key.toUpperCase()} — IV ${ivs[key]}/31${stats[key] !== undefined ? ` · stat atual ${stats[key]}` : ''}">
                <span class="iv-key">${key.toUpperCase()}</span>
                <span class="px-bar"><span class="px-bar-fill" style="width:${Math.round(ivs[key] / 31 * 100)}%;background:${ivColor(ivs[key])}"></span></span>
                <span class="iv-num" style="color:${ivColor(ivs[key])}">${ivs[key]}</span>
                ${stats[key] !== undefined ? `<span class="iv-stat">${stats[key]}</span>` : ''}
            </div>`).join('')}</div>
    </div>`;

    let html = `<div class="enc-screen">` + head + meta + ivsSection;
    if (!state.caught) html += bestPlay(foe);
    html += renderWeaknesses(foe) + renderFoeMoves(foe);
    html += renderBalls(foe) + renderStages();
    if (state.caught) html += '<div class="gotcha"><span class="gotcha-badge">GOTCHA</span><p>Pokémon capturado</p></div>';
    else if (state.moves.length) html += `<div class="section"><div class="section-head"><span class="px-label">SEUS GOLPES</span></div><div class="rows">` +
        state.moves.map((move) => `<div class="row"><span class="label">${escapeHtml(move.name)}</span><span class="value">${move.pp} PP</span></div>`).join('') + '</div></div>';
    html += `</div>`;
    content.innerHTML = html;
    PokemonAbilityInfo.hydrate(content);
}
```

`renderBalls` e `renderStages` mantêm a lógica; trocar seus `<h2>...</h2>` por
`<div class="section-head"><span class="px-label">POKÉBOLAS</span></div>` /
`ATRIBUTOS ALTERADOS`, e envolver cada um em `<div class="section"><div class="rows">…</div></div>`.

- [ ] **Step 3: Verificar**

`node --check battle.js`. Extensão unpacked, entrar numa batalha selvagem:
cabeçalho com nome/Lv/gênero/tipos/HP; grade meta 2×3 com tooltips; IVS/STATS
em 6 colunas; caixa âmbar MELHOR JOGADA com badges; FRAQUEZAS DELE; GOLPES DELE
com `▸` expandindo os matchups; Pokébolas com % de captura; captura mostra
GOTCHA.

- [ ] **Step 4: Commit**

```bash
git add battle.html battle.js
git commit -m "feat: tela de encontro no layout v2 (melhor jogada, fraquezas, golpes expansíveis)"
```

---

### Task 6: Calculadora (`index.html` + `app.js`)

**Files:**
- Modify: `index.html` (`:root` local removido; `<style>` e corpo reescritos)
- Modify: `app.js` (renderização dos resultados e do grid; lógica de cálculo mantida)

**Interfaces:**
- Consumes: Tasks 1–3. Funções existentes de `app.js`: `getSelectedTypes`, `getMode`, `enforceModeConstraints`, `calculate`, `COMBOS`; `defMultiplier`/`multClass`/`multLabel` de `type-chart-data.js`.
- Produces: mensagem `{ type: 'panel-shortcut', key }` ao pressionar tecla de atalho dentro do iframe (padrão repetido nas tasks 7 e 8).

- [ ] **Step 1: Reescrever o corpo de `index.html`**

Remover o `:root` local (os tokens vêm de `pixel-theme.css`) e o `<style>`
antigo; corpo novo:

```html
<body class="px-scroll">
    <div class="calc-screen">
        <div class="mode-row">
            <button type="button" class="px-btn mode-btn active" id="mode-ataque" data-mode="ataque" data-tip="Ranqueia pelo dano que você causa.">ATAQUE</button>
            <button type="button" class="px-btn mode-btn" id="mode-defesa" data-mode="defesa" data-tip="Ranqueia pelo dano que você recebe.">DEFESA</button>
            <button type="button" class="px-btn" id="include-dual" aria-pressed="false" data-tip="Incluir combinações de dois tipos (ex: Água/Voador)">2T</button>
        </div>
        <div class="type-grid" id="type-grid"></div>
        <div class="target-row" data-tip="" id="target-row">
            <span class="px-label">ALVO</span>
            <div class="target-chips" id="target-chips"></div>
            <button type="button" class="clear-btn" id="clear-selection">LIMPAR</button>
        </div>
        <p class="hint" id="hint">Selecione ao menos um tipo acima.</p>
        <div id="results"><div id="results-body"></div></div>
    </div>
    <!-- scripts iguais aos atuais, com pixel-icon.js e tooltip.js já adicionados -->
</body>
```

CSS novo (no `<style>` da página):

```css
* { box-sizing: border-box; }
body { margin: 0; background: var(--px-bg); color: var(--px-text); font-family: var(--px-font-body); font-size: 15px; padding: 9px 10px 14px; }
.calc-screen { display: flex; flex-direction: column; gap: 10px; }
.mode-row { display: flex; gap: 4px; }
.mode-btn { flex: 1; padding: 7px 0; letter-spacing: 1.5px; }
#include-dual { width: 44px; }
#include-dual[aria-pressed="true"] { background: var(--px-accent); border-color: var(--px-accent); color: var(--px-on-dark); }
.type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.type-cell { height: 30px; display: flex; align-items: center; justify-content: center; gap: 5px; border: 2px solid var(--px-border); padding: 0; cursor: pointer; font-family: var(--px-font-mono); font-size: 11px; }
.type-cell.selected { border-color: var(--px-accent); }
.target-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--px-bg-card); border: 1px solid var(--px-line); }
.target-chips { display: flex; gap: 4px; flex: 1; }
.clear-btn { font-family: var(--px-font-mono); font-size: 9px; background: none; border: none; color: var(--px-text-dim); padding: 0; cursor: pointer; }
.hint { color: var(--px-text-dim); margin: 0; }
#results { display: none; }
.calc-rows { display: flex; flex-direction: column; gap: 7px; }
.calc-row { display: flex; align-items: flex-start; gap: 7px; }
.calc-mult { width: 38px; flex: 0 0 auto; font-family: var(--px-font-mono); font-size: 12px; padding: 7px 0; text-align: center; }
.calc-types { flex: 1; display: flex; flex-wrap: wrap; gap: 4px; }
```

- [ ] **Step 2: Adaptar `app.js`**

1. Grid de tipos: em vez de checkboxes, gerar botões:

```js
        TYPES.forEach((type) => {
            const bg = PokemonPixelIcons.typeColor(type);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'type-cell';
            btn.dataset.type = type;
            btn.dataset.tip = LABELS[type];
            grid.appendChild(btn);
        });
        function paintGrid() {
            const selected = getSelectedTypes();
            grid.querySelectorAll('.type-cell').forEach((btn) => {
                const type = btn.dataset.type;
                const bg = PokemonPixelIcons.typeColor(type);
                const on = selected.includes(type);
                const fg = on ? PokemonPixelIcons.onColor(bg) : PokemonPixelIcons.mix(bg, '#ffffff', .45);
                btn.classList.toggle('selected', on);
                btn.style.background = on ? bg : PokemonPixelIcons.mix(bg, '#11111a', .2);
                btn.style.color = fg;
                btn.innerHTML = `${PokemonPixelIcons.typeIcon(type, fg)}<span>${ABBR[type]}</span>`;
            });
        }
```

2. Seleção vira array em memória (`let selectedTypes = []`) com clique
   alternando (máx. 2 — ao passar de 2, descarta o mais antigo, como no
   mockup); `getSelectedTypes()` passa a retornar esse array (uma linha).
   `clear-selection` zera e recalcula.
3. Modo: os dois botões `.mode-btn` alternam `active` entre si;
   `getMode()` lê `document.querySelector('.mode-btn.active').dataset.mode`.
   `include-dual` alterna `aria-pressed` (a lógica atual de "dual só na
   defesa" continua: no modo ataque, desabilitar o botão com `disabled` +
   `data-tip` explicando).
4. Chips do alvo: função que preenche `#target-chips` com
   `typeTagHTML(selectedTypes)` por tipo selecionado (um chip por tipo) e
   atualiza o `data-tip` de `#target-row` com
   `Alvo: X / Y (duplo)` ou `Selecione até 2 tipos do alvo.`.
5. Resultados: agrupar `entries` (já calculadas pela lógica atual) por valor
   de multiplicador em ordem `[4, 2, 1, .5, .25, 0]` e renderizar:

```js
        function renderGroupedResults(entries) {
            const order = [4, 2, 1, .5, .25, 0];
            const byValue = new Map(order.map((value) => [value, []]));
            entries.forEach(({ combo, value }) => { if (byValue.has(value)) byValue.get(value).push(combo); });
            return `<div class="calc-rows">` + order
                .filter((value) => byValue.get(value).length)
                .map((value) => `<div class="calc-row">
                    <span class="calc-mult ${multClass(value)}">${multLabel(value)}</span>
                    <span class="calc-types">${byValue.get(value).slice(0, 24).map((combo) => typeTagHTML(combo)).join('')}</span>
                </div>`).join('') + `</div>`;
        }
```

   (No modo ataque, `entries` são os tipos atacantes vs alvo; no modo defesa,
   os defensores vs os tipos escolhidos — mesma lógica de valor que o
   `calculate()` atual já produz; apenas o HTML final muda.)
6. Atalhos do painel — adicionar ao final do arquivo (e repetir nas tasks 7–8):

```js
window.addEventListener('keydown', (event) => {
    if (/INPUT|TEXTAREA/.test(event.target.tagName)) return;
    const key = event.key.toLowerCase();
    if (['e', 'c', 't', 'm', ',', 'f', 'escape'].includes(key)) {
        window.parent.postMessage({ type: 'panel-shortcut', key }, '*');
    }
});
```

- [ ] **Step 3: Verificar**

`node --check app.js`. Extensão unpacked, aba calculadora: grade 3 colunas com
ícones pixel; selecionar 1–2 tipos mostra chips no ALVO e resultados agrupados
por multiplicador; ATAQUE/DEFESA alternam; 2T funciona na defesa; LIMPAR zera;
teclas `E`/`M` com o mouse sobre o iframe trocam de aba.

- [ ] **Step 4: Commit**

```bash
git add index.html app.js
git commit -m "feat: calculadora de tipos no layout v2"
```

---

### Task 7: Tabela completa (`chart.html` + `chart.js`)

**Files:**
- Modify: `chart.html` (`:root` local removido, `<style>` reescrito, botão VOLTAR)
- Modify: `chart.js` (células/cabeçalhos com o visual novo; lógica de highlight/filtro/pin mantida)

**Interfaces:**
- Consumes: Tasks 1–3; `buildChart`, `applyChartHighlight`, filtros e pin existentes em `chart.js`.
- Produces: `{ type: 'panel-exit-full' }` postado ao clicar em VOLTAR (consumido pelo shell, Task 4).

- [ ] **Step 1: `chart.html`**

Remover o `:root` local. Substituir título/subtítulo por uma linha de topo:

```html
    <div class="chart-top">
        <span class="chart-title">TABELA DE TIPOS</span>
        <span class="chart-caption" id="chart-caption">linha = atacante · coluna = defensor</span>
        <span class="chart-legend">
            <span class="legend-item"><span class="legend-swatch mult-2"></span>2×</span>
            <span class="legend-item"><span class="legend-swatch" style="background:#14141d"></span>1×</span>
            <span class="legend-item"><span class="legend-swatch mult-0-5"></span>½×</span>
            <span class="legend-item"><span class="legend-swatch mult-0"></span>0×</span>
        </span>
        <button type="button" class="px-btn px-btn-accent" id="chart-back">◂ VOLTAR</button>
    </div>
```

CSS principal do novo `<style>` (manter as regras de filtro/autocomplete,
trocando cores antigas pelos tokens):

```css
body { margin: 0; background: var(--px-bg); color: var(--px-text); font-family: var(--px-font-body); font-size: 15px; padding: 12px 16px 16px; }
.chart-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.chart-title { font-family: var(--px-font-mono); font-size: 13px; letter-spacing: 1.5px; color: var(--px-text-hi); white-space: nowrap; }
.chart-caption { font-size: 14px; color: var(--px-text-dim); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.chart-legend { display: flex; gap: 10px; align-items: center; font-family: var(--px-font-mono); font-size: 11px; color: var(--px-text-soft); }
.legend-item { display: flex; align-items: center; gap: 5px; }
.legend-swatch { width: 14px; height: 14px; display: inline-block; }
table.type-chart { border-collapse: separate; border-spacing: 2px; }
table.type-chart th, table.type-chart td {
    text-align: center; padding: 4px 5px;
    font-family: var(--px-font-mono); font-size: 11px;
    border: 0; transition: opacity .1s;
}
table.type-chart th.corner, table.type-chart th.col-head, table.type-chart th.row-head { position: sticky; background: var(--px-bg); }
.chart-cell.mult-1 { background: var(--px-bg-cell); color: transparent; }
table.type-chart td.dim, table.type-chart th.dim { opacity: 0.28; }
table.type-chart td.hl { outline: 2px solid var(--px-accent); outline-offset: -2px; }
table.type-chart th.hl { outline: 2px solid var(--px-accent); outline-offset: -2px; }
```

(As classes `.mult-*` das células já vêm do Task 1 via `multClass` — as regras
locais `.chart-cell.mult-*` antigas são removidas, exceto a de `mult-1` acima
que esconde o "1×" deixando a célula vazia como no mockup.)

- [ ] **Step 2: `chart.js`**

- Em `buildChart()`, os cabeçalhos usam ícone pixel + abreviação em vez de
  `typeTagHTML`/`iconOnlyTag`:

```js
function headTag(type, withLabel) {
    const bg = PokemonPixelIcons.typeColor(type);
    const fg = PokemonPixelIcons.onColor(bg);
    return `<span class="head-tag" style="background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;gap:4px;padding:3px 4px;">` +
        PokemonPixelIcons.typeIcon(type, fg) +
        (withLabel ? `<span style="font-family:var(--px-font-mono);font-size:11px;">${ABBR[type]}</span>` : '') +
        `</span>`;
}
```

  Linhas usam `headTag(type, true)`, colunas `headTag(type, false)`. `data-tip`
  nos cabeçalhos: `"${LABELS[type]} — atacando (linha)"` / `"— defendendo (coluna)"`.
- Células: manter `multClass(value)`; conteúdo `multLabel(value)` exceto 1×
  (mantém o texto, a CSS o esconde); `data-tip = "${LABELS[atk]} → ${LABELS[def]} = ${multLabel(value)}"`.
- No hover de cabeçalho (já existe via `applyChartHighlight`), atualizar também
  `#chart-caption`: `Atacando com X` / `Defendendo como X`; ao limpar, voltar a
  `linha = atacante · coluna = defensor`.
- Botão VOLTAR:

```js
document.getElementById('chart-back').addEventListener('click', () => {
    window.parent.postMessage({ type: 'panel-exit-full' }, '*');
});
```

- Adicionar o mesmo listener de atalhos do Task 6 Step 2 item 6.

- [ ] **Step 3: Verificar**

`node --check chart.js`. Extensão unpacked, `F` numa aba de conteúdo: matriz ao
lado com células coloridas, 1× vazio; hover num cabeçalho destaca linha/coluna
e troca a legenda; filtros e pin continuam funcionando; VOLTAR sai do full.

- [ ] **Step 4: Commit**

```bash
git add chart.html chart.js
git commit -m "feat: tabela de tipos no layout v2 com destaque de linha/coluna"
```

---

### Task 8: Meus Pokémon (`myPokemons.html` + `myPokemons.js` + filtros)

**Files:**
- Modify: `myPokemons.html` (`<style>` e toolbar)
- Modify: `myPokemons.js` (render de card/grupo/toolbar; dados e filtros mantidos)
- Modify: `components/pokemon-filters.css` (re-skin com tokens)

**Interfaces:**
- Consumes: Tasks 1–4 (inclusive mensagem `panel-mode` do shell); `createPokemonViewModel`, `applyFilters`, `renderCollapsibleGroup`, `UI_STATE`, `pokemon-filters.js` existentes.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Toolbar em `myPokemons.html`**

```html
        <div class="pokemon-toolbar">
            <div class="pokemon-toolbar-main">
                <input type="search" class="px-input pokemon-filter" id="pokemon-name-filter" placeholder="Filtrar por nome…" aria-label="Filtrar Pokémon por nome">
                <button type="button" class="px-btn pokemon-advanced-toggle" id="toggle-advanced-filters" aria-pressed="false" data-tip="Filtros avançados: tipo, nível, IVs, natureza, item, gênero.">▤</button>
            </div>
            <button type="button" class="px-btn" id="expand-all-pokemon" aria-pressed="false" data-tip="Abre os detalhes de todos os Pokémon de uma vez. Cada grupo abre e fecha pelo próprio título.">DETALHES DE TODOS</button>
            <div class="pokemon-advanced-filters" id="pokemon-advanced-filters" hidden></div>
        </div>
```

O switch "Expandir todos os grupos" também vira `px-btn` (`GRUPOS ABERTOS`)
ao lado de DETALHES DE TODOS, preservando `id="expand-all-groups"` e
`aria-checked`→`aria-pressed` (ajustar `bindControls`/`syncGlobalControls` em
`myPokemons.js` para ler `aria-pressed`).

`<style>` novo da página (substituindo o atual; regras de card abaixo):

```css
* { box-sizing: border-box; }
body { margin: 0; padding: 9px 10px 14px; background: var(--px-bg); color: var(--px-text); font-family: var(--px-font-body); font-size: 15px; }
.page-container { width: 100%; }
.pokemon-toolbar { display: grid; gap: 8px; margin-bottom: 8px; }
.pokemon-toolbar-main { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 4px; }
.px-btn[aria-pressed="true"] { background: var(--px-accent); border-color: var(--px-accent); color: var(--px-on-dark); }
.pokemon-group-toggle { display: flex; align-items: center; gap: 7px; width: 100%; border: 0; background: none; color: inherit; font: inherit; padding: 0; cursor: pointer; }
.group-title { font-family: var(--px-font-mono); font-size: 10px; color: var(--px-accent); letter-spacing: 1.5px; text-transform: uppercase; }
.group-rule { flex: 1; height: 1px; background: var(--px-line); }
.group-counter { font-family: var(--px-font-mono); font-size: 10px; color: var(--px-text-dim); }
.pokemon-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); align-items: start; gap: 6px; margin: 6px 0 12px; }
.pokemon-card { background: var(--px-bg-card); border: 1px solid var(--px-line); border-left: 4px solid var(--card-type-color, var(--px-border)); padding: 6px 8px; display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.pokemon-card-toggle { display: flex; align-items: center; gap: 8px; width: 100%; border: 0; background: none; color: inherit; font: inherit; text-align: left; padding: 0; cursor: pointer; }
.pokemon-icon { width: 38px; height: 38px; flex: 0 0 auto; background: repeating-linear-gradient(45deg, #1a1a24 0 4px, #15151e 4px 8px); box-shadow: inset 0 0 0 1px var(--px-border); object-fit: contain; }
.pokemon-id-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.pokemon-name { font-family: var(--px-font-mono); font-size: 11px; color: #f0f0f6; display: flex; align-items: baseline; gap: 5px; min-width: 0; }
.pokemon-name-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: uppercase; }
.pokemon-gender-f { color: var(--px-female); }
.pokemon-gender-m { color: var(--px-male); }
.pokemon-chips { display: flex; gap: 3px; }
.pokemon-right { text-align: right; display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
.pokemon-level { font-size: 15px; color: var(--px-text-val); }
.pokemon-ivbar { display: flex; align-items: center; gap: 4px; }
.pokemon-ivbar .px-bar { width: 34px; }
.pokemon-ivbar-label { font-family: var(--px-font-mono); font-size: 9px; width: 34px; text-align: right; }
.pokemon-details { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px solid var(--px-line); }
.detail-row { display: flex; gap: 6px; min-width: 0; align-items: baseline; }
.detail-key { font-family: var(--px-font-mono); font-size: 8px; color: var(--px-text-dim); width: 62px; flex: 0 0 auto; text-transform: uppercase; }
.detail-val { font-size: 15px; color: var(--px-text-val); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.nat-mod { font-family: var(--px-font-mono); font-size: 8px; padding: 2px 4px; background: var(--px-bg-btn2); }
.pokemon-iv-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; }
.pokemon-iv { display: flex; flex-direction: column; align-items: center; gap: 2px; background: var(--px-bg-btn2); padding: 3px 0; }
.pokemon-iv .k { font-family: var(--px-font-mono); font-size: 8px; color: var(--px-text-dim); }
.pokemon-iv .v { font-family: var(--px-font-mono); font-size: 10px; }
.moves-head { display: flex; align-items: center; gap: 7px; margin-top: 2px; }
.moves-head::after { content: ''; flex: 1; height: 1px; background: var(--px-line); }
.pokemon-move { display: flex; align-items: center; gap: 7px; background: var(--px-bg-btn2); padding: 4px 6px; }
.pokemon-move-type { width: 24px; height: 24px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
.pokemon-move-name { flex: 1; min-width: 0; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pokemon-move-category { font-family: var(--px-font-mono); font-size: 9px; }
.pokemon-move-pp { font-family: var(--px-font-mono); font-size: 9px; color: var(--px-text-dim); width: 44px; text-align: right; }
.empty { margin: 0; padding: 16px; border: 1px dashed var(--px-border); text-align: center; color: var(--px-text-dim); }
[hidden] { display: none !important; }
body.full .pokemon-list { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
```

- [ ] **Step 2: `myPokemons.js` — render de card/grupo**

- `renderPokemonCard(viewModel)`: gerar a estrutura acima —
  borda esquerda via `style="--card-type-color: ${PokemonPixelIcons.typeColor(viewModel.types[0])}"`;
  sprite continua vindo de `ICON_URL` (com o fallback atual) dentro de
  `<img class="pokemon-icon">`; nome + gênero (`pokemon-gender-f/m`);
  chips `typeTagHTML(type, {stack:true})`; à direita `Lv` e a barrinha de IV
  (`px-bar` com fill `width:${viewModel.ivPercent}%` e cor por faixa —
  ≥80 verde, ≥50 âmbar, senão vermelho — mesma cor no rótulo `%`, com
  `data-tip` listando os IVs por stat).
- Detalhes expandidos: `detail-row`s NATUREZA (com `nat-mod`s
  verde/vermelho vindos de `natureEffectHTML`/`getNatureEffect`), HABILIDADE,
  ITEM, POSIÇÃO; grade `pokemon-iv-grid` com cor por faixa
  (≥26 verde, ≥15 âmbar, senão vermelho); `moves-head` GOLPES + linhas
  `pokemon-move` (ícone do tipo em caixa colorida, nome, categoria abreviada
  FÍS/ESP/STA com as cores `#e0803c`/`#4a90e2`/`#8a8aa0`, PP).
- `renderCollapsibleGroup`: cabeçalho vira
  `▸/▾ TÍTULO ─────── contador` usando `.pokemon-group-toggle` +
  `.group-title`/`.group-rule`/`.group-counter`.
- Modo full: listener de mensagem

```js
window.addEventListener('message', (event) => {
    if (event.data?.type !== 'panel-mode') return;
    document.body.classList.toggle('full', event.data.full === true);
    UI_STATE.forceExpandAll = event.data.full === true;
    render();
});
```

  e, onde o render decide se um card está expandido, considerar também
  `UI_STATE.forceExpandAll` (sem persistir esse estado).
- Adicionar o listener de atalhos do Task 6 Step 2 item 6.

- [ ] **Step 3: Re-skin de `components/pokemon-filters.css`**

Trocar cores hardcoded antigas pelos tokens: fundos `#1c1f28/#21242f` →
`var(--px-bg-card)/var(--px-bg-btn2)`, bordas `#000/#2e3240/#454b5e` →
`var(--px-border)/var(--px-line)/var(--px-border-btn)`, texto dim `#9198ab` →
`var(--px-text-dim)`, acento `#f7d02c/#ffb238` → `var(--px-accent)`, verde
`#57c785` → `var(--px-good)`, vermelho `#e2637a` → `var(--px-bad)`; inputs
ganham a cara de `.px-input` (borda 1px, sem radius) e labels
`font-family: var(--px-font-mono)`. Nenhuma mudança em
`components/pokemon-filters.js`.

- [ ] **Step 4: Verificar**

`node --check myPokemons.js`. Extensão unpacked, aba Meus Pokémon: busca +
`▤` abre filtros restilizados; DETALHES DE TODOS expande tudo; grupos
MEU TIME/CAIXA colapsam pelo título; cards com borda de tipo, barra de IV e
detalhes completos; `F` expande em grade multi-coluna com detalhes abertos.

- [ ] **Step 5: Commit**

```bash
git add myPokemons.html myPokemons.js components/pokemon-filters.css
git commit -m "feat: tela Meus Pokémon no layout v2"
```

---

### Task 9: Limpeza, README e verificação final

**Files:**
- Modify: `pixel-theme.css` (remover legado), `README.md`
- Verify: manifests, build scripts, Firefox

- [ ] **Step 1: Remover o legado de `pixel-theme.css`**

- Remover o `@font-face` do Press Start 2P (data-URI grande no topo).
- Buscar consumidores restantes antes de apagar classes:

```bash
grep -rn "pxl-" --include="*.html" --include="*.js" . | grep -v dist | grep -v docs
```

  Remover do CSS todas as classes `pxl-*` sem consumidor (esperado: sobra
  pouco ou nada; `--pxl-fs-*` só se ainda houver referência). Qualquer
  referência remanescente a `'Press Start 2P'` em HTML/JS (ex.: `font-family`
  no `content.js`) deve ter sido trocada nas tasks anteriores — confirmar com:

```bash
grep -rn "Press Start" --include="*.css" --include="*.html" --include="*.js" . | grep -v dist
```

  (deve retornar vazio ao final).

- [ ] **Step 2: Atualizar `README.md`**

Nas seções que descrevem a interface: mencionar as 4 abas com ícones pixel +
config, os atalhos de teclado (E/C/M/vírgula/F/Esc, válidos com o foco no
painel), o modo full com a tabela ao lado, o toggle de tooltips e o stepper de
largura. Não reescrever seções de arquitetura/interceptação.

- [ ] **Step 3: Verificação final completa**

```bash
for f in content.js background.js app.js battle.js chart.js myPokemons.js components/*.js data/*.js; do node --check "$f" || echo "FALHOU: $f"; done
bash scripts/build-chrome.sh && bash scripts/build-firefox.sh
```

Chrome unpacked — checklist manual:
1. Abrir o painel no jogo; 4 abas + expandir + `_`; status bar com dot.
2. Encontro: entrar em batalha → tela nova completa; expandir golpes; captura → GOTCHA.
3. Calculadora: seleção, modos, 2T, LIMPAR, resultados agrupados.
4. `F`: tabela ao lado (calc/encontro/config); VOLTAR/`Esc` saem; em Meus Pokémon vira grade larga.
5. Meus Pokémon: busca, filtros avançados, DETALHES DE TODOS, grupos, cards.
6. Config: largura −/+ (250–380), toggles (update/beta/tooltips), atalhos listados; desligar tooltips remove as dicas em todas as telas.
7. Redimensionar por arrasto e mover pelo header continuam funcionando; bolha reabre; recarregar a página restaura estado.
8. Firefox (carregar `manifest.firefox.json` via about:debugging) — smoke test de abertura e abas.

- [ ] **Step 4: Commit final**

```bash
git add pixel-theme.css README.md
git commit -m "feat: remove tema legado (Press Start 2P/pxl-*) e documenta o novo layout"
```

Depois seguir a skill superpowers:finishing-a-development-branch (PR de
`feat/novo-layout-pixel` para `develop`).
