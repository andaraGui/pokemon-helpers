# Correções do painel: barras de IV, golpes do oponente, layout expandido, atalhos globais e fonte única

**Data:** 2026-08-07
**Status:** aprovado

Cinco correções independentes reportadas em uso real, entregues numa branch
única (`fix/ajustes-painel`), um commit por item.

## 1. Barras de IV não preenchem

**Problema:** no grid IVS/STATS da batalha (e na barra de IV de Meus
Pokémon), o trilho aparece mas o preenchimento colorido nunca é desenhado.

**Causa raiz:** `.px-bar-fill` é um `<span>` sem `display` definido
(`pixel-theme.css`). Elemento inline não-substituído ignora `width`/`height`,
então o `width:N%` que `battle.js`/`myPokemons.js` já calculam nunca tem
efeito. O `.px-bar` externo só aparece porque vira flex item (blockificado)
nos dois contextos.

**Correção:** adicionar `display: block` a `.px-bar-fill` em
`pixel-theme.css`. Nenhuma mudança de JS. Corrige as duas telas de uma vez.

## 2. Golpes do oponente somem após um golpe ser confirmado

**Problema:** antes do primeiro turno, GOLPES DELE mostra os golpes
estimados (heurística por nível ou wiki de treinador). Assim que o oponente
usa um golpe, ele vira "descoberto" e `resolveFoeMoves` (battle.js) passa a
retornar **apenas** a lista descoberta — a lista visível encolhe para 1 item
e os estimados desaparecem no meio da luta.

**Decisão (usuário):** mesclar em vez de substituir.

**Correção:** `resolveFoeMoves` monta uma lista única de até 4 golpes, com
dedupe por slug, nesta ordem de prioridade:

1. golpes confirmados em batalha contra esse oponente recorrente
   (`discoveredMovesByKey`);
2. moveset exato de treinador da wiki (`trainerMovesByKey`, apenas em
   batalha de treinador);
3. heurística por nível (`probableMoves`).

Cada golpe carrega sua origem individual (`discovered` | `trainer` |
`heuristic`). Em `renderFoeMoves`:

- golpes confirmados ganham um selo **VISTO** no item;
- os demais seguem sem selo (estimados);
- o tooltip do cabeçalho da seção descreve a composição atual (ex.:
  "1 visto em batalha; os demais são estimados pelo nível" ou o texto de
  fonte única quando não há mistura).

A persistência de golpes descobertos (`saveDiscoveredMoves`) não muda.

## 3. Calculadora à direita no modo expandido

**Problema:** ao expandir o painel (tecla F) com a calculadora ou a batalha
ativa, a tabela 18×18 fica à esquerda e a view ativa à direita. O desejado é
a view ativa (calculadora) à esquerda.

**Correção:** inverter os `order` nas regras `.full-side` do stylesheet
injetado por `content.js`: `.ph-frame.side-active` passa a `order: 0` com
`border-right` (em vez de `border-left`), e `#pokemon-chart-frame` passa a
`order: 1`, continuando a preencher o espaço restante. Só CSS; a lógica de
`syncFullSide` não muda.

## 4. Atalhos globais e devolução de foco ao jogo

**Problema (duas partes):**

1. Os atalhos só funcionam com o foco dentro do painel — o `keydown` é
   escutado no container e nos iframes, nunca no documento do jogo (decisão
   antiga, porque os padrões são letras soltas: E, C, M, T, F, ESC).
2. Depois de clicar no painel, o foco fica preso no iframe e o jogo para de
   receber teclado até o usuário clicar no jogo de novo.

**Decisão (usuário):** atalhos passam a ser globais e a extensão **consome**
a tecla quando ela bate com um atalho configurado — o jogo não a vê. Quem
quiser reservar uma tecla para o jogo troca o atalho nas Configurações.

**Correção (content.js):**

- **Listener global:** `keydown` no documento do jogo, em capture phase,
  registrado uma única vez (guarda em `window`, como os listeners
  existentes). Se o alvo for campo de texto (`INPUT`/`TEXTAREA`/`SELECT`/
  `contentEditable`), ignora. Também ignora eventos originados dentro do
  painel de Configurações — ele é um `<div>` no documento do jogo (não um
  iframe), e a captura de tecla de atalho vive lá: sem essa exceção, o
  `stopImmediatePropagation()` engoliria a tecla que o usuário está tentando
  gravar. Se o combo bater com um atalho configurado: executa a ação,
  `preventDefault()` e `stopImmediatePropagation()`.
- **Painel minimizado:** atalhos de view passam a funcionar com o painel em
  bolha — expandem e abrem a aba pedida (hoje `performAction` retorna cedo
  quando colapsado; o early-return passa a valer só para ações que não fazem
  sentido colapsado, como `toggleFull`/`minimize`).
- **Sem disparo duplo:** o listener de `keydown` do container é removido —
  o listener global de documento já cobre teclas dentro do shell; o
  `shortcut-forwarder` dos iframes continua como está (iframes são
  documentos separados, o listener global não os enxerga).
- **Devolução de foco:** após interações de clique no painel, o foco volta
  ao documento do jogo (blur do iframe/elemento ativo, via mensagem
  `panel-interaction` postada pelos iframes no clique e handler equivalente
  para cliques no shell). Exceção: com a aba **Configurações** ativa o foco
  permanece no painel, porque ela tem inputs e a captura de tecla de atalho.

## 5. Fonte única: Silkscreen para tudo

**Problema:** o painel usa duas fontes embutidas em `pixel-theme.css` —
Pixelify Sans (`--px-font-body`, texto e boa parte dos números: stats do
grid de IVs, `meta-val`, `.row .value`) e Silkscreen (`--px-font-mono`,
rótulos e números pequenos). Os dígitos da Pixelify Sans são difíceis de
ler nos tamanhos do painel.

**Decisão (usuário, após comparação visual):** usar Silkscreen para tudo —
letras e números — aposentando a Pixelify Sans.

**Correção:**

- `pixel-theme.css`: `--px-font-body` passa a `'Silkscreen', monospace`
  (o token `--px-font-mono` já é Silkscreen; os dois passam a coincidir,
  mas ambos são mantidos para não tocar em todos os consumidores).
- Varredura das referências diretas a `'Pixelify Sans'` fora do token —
  `content.js` (estilo injetado do shell), `components/tooltip.js`,
  `components/pokemon-filters.css` — trocando por `var(--px-font-body)`
  (ou `'Silkscreen', monospace` onde a var não estiver disponível).
- Remover o `@font-face` da Pixelify Sans (~12 KB de base64) quando nenhuma
  referência sobrar.
- **Passe de tamanhos:** a Silkscreen é mais larga que a Pixelify no mesmo
  corpo — revisar visualmente os textos de 14–15px (valores, labels de
  configurações, linhas de golpes) e reduzir o `font-size` onde estourar
  o layout.
- **Acentos:** o subset embutido da Silkscreen já renderiza maiúsculas
  acentuadas (AVALIAÇÃO, POKÉBOLAS no painel atual). Verificar as
  minúsculas usadas pelo texto corrido (Médio, Físico, Precisão, Evasão);
  se faltar glifo, re-embutir a Silkscreen com subset latino completo, no
  mesmo padrão base64 dos @font-face atuais.

## Fora de escopo

- Migração dos atalhos padrão para combos com modificador (Alt+E etc.).
- Qualquer mudança em `interceptor.js` ou nos manifests.

## Verificação (manual — projeto sem suíte de testes)

Carregar a extensão descompactada em `infinitymmo.net` e conferir:

1. barras de IV preenchidas e coloridas na batalha e em Meus Pokémon;
2. numa luta, após o oponente usar um golpe, a lista GOLPES DELE mantém os
   estimados e marca o confirmado com VISTO;
3. F na calculadora: calculadora à esquerda, tabela 18×18 à direita;
4. com o foco no jogo (sem clicar no painel), E/C/M/T/F/ESC acionam o
   painel e o jogo não reage à tecla; após clicar em botões do painel, o
   jogo volta a responder ao teclado sem clique extra; digitar no chat do
   jogo não aciona atalhos; captura de atalho nas Configurações continua
   funcionando;
5. todo o painel (batalha, calculadora, Meus Pokémon, configurações,
   tooltips) renderiza em Silkscreen, sem sobras de Pixelify Sans; textos
   acentuados em minúsculas (Médio, Físico, Precisão) aparecem corretos;
   nenhum valor estoura seu contêiner nos tamanhos ajustados.
