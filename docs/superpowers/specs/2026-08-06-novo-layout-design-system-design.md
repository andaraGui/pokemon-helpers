# Novo layout do painel + design system pixel

**Data:** 2026-08-06
**Origem:** mockup "Extensao Painel (standalone).html" (export bundled; página real
extraída do `<script type="__bundler/template">`).
**Decisões do usuário:** escopo = layout **e** funcionalidades do mockup; nenhuma
funcionalidade atual é removida (tudo que o mockup não cobre é restilizado);
abordagem = **restilizar no lugar**, mantendo a arquitetura shell (`content.js`)
+ 4 iframes.

## Objetivo

Substituir o visual atual (Press Start 2P + cores de tipo clássicas + classes
`pxl-*` ad hoc) pelo design system do mockup, e incorporar os comportamentos
novos que ele mostra: tooltips globais desligáveis, atalhos de teclado por aba,
modo "full" com a tabela ao lado do conteúdo, stepper de largura, barra de
status. A "MELHOR JOGADA" do mockup é a atual "Sugestão" de `battle.js`
restilizada — não é feature nova.

## 1. Design system — `pixel-theme.css` v2

### Fontes

- **Pixelify Sans** 400/700 — texto de corpo (valores, nomes, descrições).
- **Silkscreen** 400/700 — labels/títulos em caixa alta, números "mono",
  abreviações, teclas.
- Press Start 2P é removida.
- Os woff2 são extraídos do manifest do bundle (IDs `680c0704…`, `20e60a1b…`,
  `49d7f9ca…` = Pixelify cyr/latin-ext/latin; `43055278…`, `9ae697fc…`,
  `9cd1721e…`, `26e1b3b5…` = Silkscreen) e embutidos como data-URI no CSS,
  mesmo padrão atual — sem requests externos em runtime.

### Tokens (CSS custom properties)

| Grupo | Valores |
|---|---|
| Fundos | `#08080d` (barras), `#0d0d14` (painel), `#11111a` (cartão), `#12121b`/`#16161f` (botão), `#14141d` (célula neutra), `#1a1a24` (trilho/base), `#2a2a36` (badge neutro) |
| Bordas | `#1c1c26` (hairline), `#23232f` (padrão), `#2b2b39` (botão), `#3a3a4c` (tooltip) |
| Texto | `#ffffff` (título), `#e6e6f0` (corpo), `#c8c8dc` (valor), `#a8a8c0` (secundário), `#8a8aa0` (label/mudo) |
| Acento | `#ffb545` (âmbar — aba ativa, links, destaques); hover de link `#ffd08a`; caixa "melhor jogada" borda `#4a3a12` fundo `linear-gradient(#1b1509,#15110a)` |
| Semânticas | bom `#63bb5b`, ruim `#ea6f83`, fêmea `#f56a8a`, macho `#4a90e2`, IV médio `#d9a642` |
| Multiplicador (fundo) | 4× `#2f9e5e`, 2× `#3f8f5a`, 1× `#2a2a36`, ½× `#8a4550`, ¼× `#6e3540`, 0× `#3a3a4c` |
| Multiplicador (texto) | 4×/2× `#0c0c11`, 1× `#a8a8c0`, ½×/¼× `#ffe0e4`, 0× `#cfcfe0` |

Scrollbar fina (7px, track `#0d0d14`, thumb `#2e2e3c`), animação `blip`
(piscar em steps) para o dot de status.

### Cores de tipo (substituem os `--t-*` atuais)

| AB | Nome | Cor | AB | Nome | Cor |
|---|---|---|---|---|---|
| NRM | Normal | `#9a9a80` | FLY | Voador | `#8f7fe0` |
| FIR | Fogo | `#f0803c` | PSY | Psíquico | `#f56a8a` |
| WTR | Água | `#4a90e2` | BUG | Inseto | `#92bc2c` |
| ELC | Elétrico | `#f5cd35` | RCK | Pedra | `#c9b787` |
| GRS | Planta | `#63bb5b` | GHO | Fantasma | `#7b62a3` |
| ICE | Gelo | `#7fd6d6` | DRG | Dragão | `#5f6fe8` |
| FGT | Lutador | `#d3425f` | DRK | Sombrio | `#6f6880` |
| PSN | Venenoso | `#b763cf` | STL | Metálico | `#8fa5b8` |
| GRD | Terrestre | `#d9a642` | FRY | Fada | `#ee90c0` |

O texto sobre a cor do tipo usa contraste automático: escolhe `#0c0c11` ou
`#f4f4fa` pelo maior contraste WCAG (funções `lum`/`ratio`/`onColor` do mockup).

### Ícones pixel 7×7 — novo `components/pixel-icon.js`

Bitmaps 7×7 (strings `0/1` separadas por `/`) renderizados como box-shadow de
um quadrado de 2×2 px dentro de uma âncora 14×14 (função `px(map, cor, 2)`).

Tipos:

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
```

Abas/UI:

```
enc  0001000/0011100/0110110/1110111/0110110/0011100/0001000
calc 1111111/1000001/1011101/1000001/1010101/1010101/1111111
tbl  1111111/1001001/1111111/1001001/1111111/1001001/1111111
team 0011100/0100010/1111111/1000001/1010101/1000001/1111111
cfg  0101010/1111111/1110111/1100011/1110111/1111111/0101010
```

### Componentes restilizados

- **`components/type-tag.js`** — chip: fundo na cor do tipo, ícone pixel +
  abreviação em Silkscreen, texto por contraste automático, tooltip com o nome
  completo.
- **Chips de multiplicador** — bloco de largura fixa com fundo/texto da tabela
  de multiplicadores (½×, ¼× com os glifos `½`/`¼`).
- **Cabeçalho de seção** — label Silkscreen 10px `#8a8aa0` (âmbar quando
  destaque) + hairline `#1c1c26` preenchendo a linha.
- **Botões** — retangulares sem radius, borda `#2b2b39`, ativo = fundo/borda
  âmbar com texto `#0c0c11`.
- **Toggle** — trilho 40×22, knob 16×16, ligado = fundo `#3f8f5a`.
- **Barras (HP/IV/stat)** — trilho `#1a1a24`, preenchimento na cor semântica.
- **Tooltip** — novo `components/tooltip.js`: caixa `position:fixed`, fundo
  `#08080d`, borda `#3a3a4c`, sombra dura `2px 2px 0 rgba(0,0,0,.5)`,
  max-width 260px, aparece abaixo do alvo (clampada à viewport), dirigida por
  `data-tip` via delegação de eventos; respeita a configuração global
  "tooltips" (nova chave em `data/extension-storage.js`).

## 2. Shell — `content.js`

- **Barra de abas (topo, 34px, fundo `#08080d`)**: botões 30×26 com ícone
  pixel (enc, calc, team, cfg), ativo em âmbar; à direita, botão de
  expandir (ícone `tbl`) e minimizar (`_`). Tooltips descrevem cada aba com a
  tecla de atalho.
- **Barra de status (base, 22px)**: dot verde piscando + linha de estado
  (`CONECTADO · ENCAIXADO 360PX · F=EXPANDIR ESC=FECHAR`), refletindo o estado
  real do painel.
- **Atalhos de teclado**: `E`=encontro, `C`/`T`=calculadora, `M`=meus
  pokémons, `,`=config, `F`=expandir/recolher, `Esc`=recolher/minimizar.
  Ignorados quando o foco está em input/textarea. A captura acontece no
  documento do jogo (via content script) **e** dentro de cada iframe,
  respeitando a lógica de foco/blur existente do overlay — sem quebrar a
  digitação no jogo.
- **Modo full (`F`)**: reaproveita o expand atual (~90% da viewport).
  - Nas abas encontro/calculadora: `chart.html` (tabela 18×18) abre **ao
    lado esquerdo** do conteúdo da aba, que mantém sua largura encaixada.
  - Na aba Meus Pokémon: sem tabela; a listagem vira grade
    `repeat(auto-fill, minmax(300px, 1fr))` com detalhes abertos.
  - `F`/`Esc`/botão "◂ VOLTAR" retornam ao modo encaixado.
- **Mantidos, restilizados**: arrastar a borda para redimensionar, botão-bolha
  de reabertura, aviso de atualização (`components/update-notice.js`), injeção
  automática e lógica `data.foe`/`data.party`/`data.pc` intocada.

## 3. Telas

### `battle.html` / `battle.js` — Encontro

Na ordem do mockup:

1. Cabeçalho: sprite 60×60 (placeholder xadrez quando não houver), nome em
   Silkscreen, `Lv`, gênero colorido, chips de tipo, barra de HP com valor.
2. Grade meta 2×3: HABILIDADE, NATUREZA, ITEM, ATQ PRINCIPAL (físico/especial
   pelo maior stat ofensivo), AVALIAÇÃO (`components/iv-evaluation.js`),
   IVS TOTAL — cada célula com tooltip explicativo.
3. IVS / STATS: 6 colunas (HP/ATK/DEF/SPA/SPD/SPE) com barrinha, IV e stat,
   cor por faixa (≥26 verde, ≥15 âmbar, senão vermelho).
4. **MELHOR JOGADA** (renomeando "Sugestão"): caixa âmbar com Pokémon, golpe
   (chip do tipo + slot), badges `2×`/`POT n`/`STAB` com tooltips.
5. FRAQUEZAS DELE: chips dos tipos com multiplicador > 1, ordenados.
6. GOLPES DELE: linhas com ícone do tipo, nome, categoria/PP, multiplicador
   contra o meu time e botão `▸/▾` que expande os matchups do golpe agrupados
   por multiplicador (golpes de status mostram aviso).
   O modal "Detalhes de movimentos e tipo" atual é **aposentado**: sua
   informação fica coberta por MELHOR JOGADA + FRAQUEZAS + a expansão por
   golpe, e os rankings completos ataque/defesa vivem na calculadora (que o
   atalho `C` abre a um toque). Nenhum dado deixa de ser alcançável.
7. Taxa de captura (`components/catch-rate.js`): mantida, restilizada como
   seção do novo layout.

### `index.html` / `app.js` — Calculadora de tipos

- Linha de modos: botões ATAQUE / DEFESA + toggle `2T` (combinações duplas).
- Grade dos 18 tipos em 3 colunas (ícone + abreviação); selecionado = borda
  âmbar; até 2 selecionados.
- Linha ALVO: chips selecionados + LIMPAR.
- Resultados agrupados por multiplicador (4×, 2×, 1×, ½×, ¼×, 0×), cada grupo
  com bloco de multiplicador + chips dos tipos.

### `chart.html` / `chart.js` — Tabela completa

- Matriz 18×18: cabeçalhos de linha (ícone + abreviação, 56px) e coluna
  (ícone); hover em cabeçalho destaca linha/coluna (resto a 28% de opacidade,
  ring âmbar) e atualiza a legenda ("Atacando com X" / "Defendendo como X").
- Células: valor `2×/½×/¼×/0×` com as cores de multiplicador; 1× fica vazia em
  `#14141d`. Tooltip "A → B = n×".
- Topo: título TABELA DE TIPOS, legenda de cores, botão "◂ VOLTAR" (sai do
  modo full).

### `myPokemons.html` / `myPokemons.js` — Meus Pokémon

- Busca por nome + botão `▤` de filtros avançados
  (`components/pokemon-filters.js` restilizado — mantém os filtros funcionais
  atuais de tipo/nível/IVs/natureza/item/gênero).
- Botão "DETALHES DE TODOS" (expande/recolhe todos os cards).
- Grupos colapsáveis: MEU TIME (contador n/6) e uma seção por caixa do PC,
  cabeçalho `▸/▾ TÍTULO ---- contador`.
- Card: borda esquerda 4px na cor do 1º tipo; sprite 38×38; nome, gênero,
  chips de tipo; à direita Lv e barra de IV total com percentual colorido.
- Expandido (clique no card): NATUREZA (+mods coloridos), HABILIDADE, ITEM,
  POSIÇÃO, grade de IVs 6 colunas, GOLPES (ícone de tipo, nome, categoria,
  PP).
- Modo full: grade multi-coluna com detalhes abertos.

### Configurações (tela `cfg` do shell)

- Seção PAINEL: largura com stepper `−`/`+` em passos de 20px, faixa
  **250–380px** (o arrastar de borda continua com a faixa atual e sincroniza o
  valor exibido); toggles: avisar atualizações, canal beta, **tooltips**
  (novo).
- Seção ATALHOS: lista tecla → ação (E, C, M, vírgula, F, ESC) + o botão
  existente de configurar o atalho do navegador.

## 4. Estado e persistência

- `data/extension-storage.js` ganha a chave `tooltipsEnabled` (default true),
  lida por todas as telas e pelo shell.
- Largura, aba ativa, colapsos e demais chaves existentes permanecem.

## 5. Integração e restrições

- Novos arquivos (`components/pixel-icon.js`, `components/tooltip.js`) entram
  em `web_accessible_resources` dos **dois** manifests e nos arrays `FILES`
  dos dois build scripts.
- **Sem bump de versão** em `manifest.json` (regra do repo — bump só em
  release).
- Sem dependências ou requests externos; fontes embutidas.
- `interceptor.js` e o roteamento por forma de payload em `content.js` não
  mudam.

## 6. Erros e casos-limite

- Dados ausentes (sem item, sem golpes conhecidos, sprite indisponível):
  placeholder `—`/xadrez, como no mockup.
- Tooltips desligados: nenhum listener exibe caixa; atalhos continuam.
- Tela estreita (250px): grades usam `minmax(0,1fr)` + `text-overflow:
  ellipsis` como no mockup; nada estoura horizontalmente.
- Modo full com viewport pequena: a tabela lateral só abre se houver espaço
  para a matriz + conteúdo; senão a tabela ocupa a área e o "VOLTAR" retorna.

## 7. Verificação

Sem suíte de testes no repo — verificação manual carregando a extensão
unpacked (Chrome e Firefox), exercitando: as 4 abas + config, atalhos de
teclado, modo full em cada aba, tooltips on/off, redimensionar (stepper e
arrasto), encontro real (payload interceptado), filtros e grupos em Meus
Pokémon, taxa de captura, e conferindo os dois manifests + build scripts.
