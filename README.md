# InfinityMMO Helper

Extensão Chrome (MV3) com overlay na página do infinitymmo.net: calculadora
de matchups de tipo + dados ao vivo do encontro/batalha atual.

## Uso

1. `chrome://extensions` → Modo do desenvolvedor → Carregar sem compactação.
2. Clique no ícone (ou `Ctrl+Shift+Y`, configurável em
   `chrome://extensions/shortcuts`) pra abrir/fechar o overlay.
3. Abas: Calculadora (🧮), Encontro (⚔️), Configurações (⚙️).

Toda alteração de código bumpa a versão em `manifest.json`, pra confirmar
que o reload pegou os arquivos novos.

## Arquivos

| Arquivo | Contexto | Papel |
|---|---|---|
| `background.js` | service worker | Injeta `content.js` e `interceptor.js` no clique/atalho |
| `interceptor.js` | MAIN world da página | Hook do `window.fetch` |
| `content.js` | isolated world | Overlay, abas, foco/desfoco automático |
| `index.html`/`app.js` | iframe | Calculadora de tipos |
| `battle.html`/`battle.js` | iframe | Dados do encontro atual |

## Interceptação

`interceptor.js` sobrescreve `window.fetch` no MAIN world (único contexto
com acesso ao fetch real da página). Quando a URL bate com
`window.__pkmnHelperBattleUrlRe` (atualmente `/\/battle\//`), clona a
resposta, faz `.json()` e dispara `CustomEvent('pkmn-helper-battle-data')`
no `window` — que atravessa pro `content.js` (isolated world) normalmente.

O regex fica numa propriedade mutável do `window` (não numa `const`) pra
atualizar sem precisar recarregar a página; só o patch do `fetch` em si
acontece uma vez por carregamento (`window.__pkmnHelperFetchPatched`).

`content.js` decide pelo formato do payload, não pela URL exata:
- `data.state.over === true` → volta pra aba Calculadora (checado primeiro,
  já que a resposta de fim de batalha também pode trazer `foe.stats`).
- `data.foe.stats` presente → foca na aba Encontro.

## DevTools no infinitymmo.net

O site tem um script anti-debug (ofuscado, embutido no HTML) que:

- Bloqueia F12, Ctrl/Cmd+Shift+I/J/C, Ctrl+U e o menu de contexto.
- Mede `outerWidth/outerHeight - innerWidth/innerHeight` a cada 1s; se a
  diferença passar de ~220px (DevTools dockado ocupando espaço na mesma
  janela), dispara o bloqueio.
- Roda um `debugger;` a cada 5s medindo `performance.now()` antes/depois; se
  o tempo de execução passar de 250ms três vezes seguidas (sinal de que o
  DevTools está pausando ali), dispara o bloqueio.
- Bloqueio = `document.documentElement.innerHTML` substituído por uma
  mensagem de "Sessão encerrada" + `location.replace('about:blank')`.

Formas de inspecionar sem disparar isso:

1. **DevTools undocked** (janela separada, não dockada) evita o gatilho de
   redimensionamento, porque a diferença outerWidth/innerWidth da janela da
   aba não muda.
2. **Ignore list** (blackbox) do script no painel Sources evita o gatilho do
   `debugger;` — script na ignore list tem `debugger;` ignorado de verdade.
   Botão direito na linha pausada (ou no arquivo) → "Add script to ignore
   list". Dá pra configurar previamente em Settings → Ignore list → padrão
   `infinitymmo\.net`, antes de sequer abrir o DevTools no site.
   (A preferência `breakpointsActive: false` **não** resolve isso — ela só
   desativa breakpoints manuais, não a instrução `debugger;`.)
3. **CDP direto** (`--remote-debugging-port`, sem UI visual, sem habilitar o
   domínio `Debugger`) evita os dois gatilhos ao mesmo tempo: sem janela
   visível não há diferença de tamanho pra medir, e sem o domínio Debugger
   habilitado o `debugger;` nunca pausa nada. É a abordagem mais robusta pra
   automação/inspeção programática (ex: script Node com `fetch` + `WebSocket`
   nativos, chamando `/json/new` via `PUT` e depois `Page.enable` /
   `Runtime.enable` / `Network.enable` — sem `Debugger.enable`).

Esse é o motivo de a extensão interceptar `fetch` em vez de depender de
abrir o Network tab manualmente: além de mais prático, evita todo esse
cat-and-mouse a cada encontro.

## Limitação conhecida

`types` vem como IDs numéricos (ex: Pidgey = `[0, 2]`); mapeamento pro nome
ainda não identificado.
