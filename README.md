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

## DevTools

O infinitymmo.net bloqueia DevTools normal (F12 trava a aba), então siga
esta ordem:

1. Abra o site e ative o overlay da extensão (ícone ou `Ctrl+Shift+Y`).
2. No painel do Chrome que abriu, clique no ícone de "⋮" → **More tools →
   Developer tools**, e logo em seguida arraste a janela do DevTools pra
   fora, deixando ela **undocked** (não presa na mesma janela da aba). Isso
   evita o gatilho de bloqueio por redimensionamento.
3. Vá em **Settings → Ignore list** e adicione o padrão `infinitymmo\.net`
   antes de continuar. Isso faz o `debugger;` do site ser ignorado de
   verdade (a opção `breakpointsActive: false` não resolve isso).
4. Agora escolha o que quer inspecionar, no menu de contexto (topo do
   painel Sources/Console) ou pelo `chrome://extensions`:
   - **Service worker** (`background.js`): `chrome://extensions` → card da
     extensão → link "service worker". Se o link tiver sumido, clique no
     ícone da extensão de novo pra acordá-lo.
   - **Content script / overlay** (`content.js`, `interceptor.js`): use o
     DevTools já aberto na aba (passo 2); troque o contexto no topo do
     Console entre "top" e a extensão.
   - **Iframes** (`index.html`/`app.js`, `battle.html`/`battle.js`): botão
     direito dentro do painel da calculadora ou do encontro → "Inspecionar".
     Também dá pra abrir a URL do iframe direto numa aba nova:
     `chrome-extension://<ID-DA-EXTENSAO>/index.html` (ou `battle.html`) —
     o ID aparece no card da extensão em `chrome://extensions`.
5. Depois de editar qualquer arquivo: `chrome://extensions` → botão de
   reload (↻) no card da extensão → recarregue a aba do site. A versão em
   `manifest.json` é bumpada a cada mudança pra confirmar visualmente (no
   card) que o reload pegou os arquivos novos.

## Limitação conhecida

`types` vem como IDs numéricos (ex: Pidgey = `[0, 2]`); mapeamento pro nome
ainda não identificado.
