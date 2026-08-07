# InfinityMMO Helper

Extensão para Chrome e navegadores Chromium (Manifest V3) que adiciona um
overlay ao infinitymmo.net. Reúne calculadora e tabela de tipos, dados ao vivo
dos encontros, visualização da Party e do PC com filtros.

## Uso

Existem duas formas de instalar a extensão: baixando os arquivos diretamente
ou clonando o repositório com Git. O download é mais simples; com Git, as
atualizações futuras ficam mais fáceis.

### Opção 1: download do ZIP (sem Git)

1. Acesse o [repositório do Pokémon Helpers](https://github.com/andaraGui/pokemon-helpers).
2. Escolha a versão desejada no seletor de branch:
   - `main`: versão estável;
   - `develop`: versão beta, com funcionalidades que ainda estão em teste.
3. Clique em **Code → Download ZIP**.
4. Extraia o ZIP em uma pasta que não será apagada ou movida. O navegador
   continuará carregando a extensão a partir dessa pasta.
5. Abra `chrome://extensions` no Chrome ou em outro navegador baseado em
   Chromium.
6. Ative o **Modo do desenvolvedor**.
7. Clique em **Carregar sem compactação** (*Load unpacked*) e selecione a
   pasta extraída que contém o arquivo `manifest.json`.
8. Deixe a extensão ativada.

O download do ZIP não recebe atualizações automaticamente. Para atualizar,
baixe novamente a branch desejada, extraia a nova versão e carregue essa
pasta no navegador. Se substituir os arquivos dentro da pasta já utilizada,
clique no botão de recarregar (↻) no card da extensão em
`chrome://extensions`.

### Opção 2: instalação com Git

Esta opção exige o [Git](https://git-scm.com/) instalado no computador.

1. Abra o Git Bash ou um terminal na pasta onde deseja guardar a extensão.
2. Clone o repositório:

   ```bash
   git clone https://github.com/andaraGui/pokemon-helpers.git
   ```

3. Entre na pasta criada:

   ```bash
   cd pokemon-helpers
   ```

4. Escolha a branch que deseja usar. Para acessar a versão beta:

   ```bash
   git switch develop
   ```

   Para usar a versão estável, permaneça na branch `main` ou execute
   `git switch main`.
5. Abra `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em
   **Carregar sem compactação** e selecione a pasta `pokemon-helpers`, que
   contém o arquivo `manifest.json`.

Para atualizar, abra um terminal dentro da pasta do projeto, confirme que
está na branch desejada e baixe as alterações:

```bash
git switch develop # ou: git switch main
git pull
```

Também é possível criar, dentro da pasta do projeto, um arquivo chamado
`Atualizar.sh` com este conteúdo:

```bash
git pull
```

Nesse caso, execute o arquivo para buscar as atualizações da branch atual.
Depois de atualizar por qualquer um dos métodos, volte a
`chrome://extensions`, clique no botão de recarregar (↻) no card da extensão
e recarregue a página do jogo.

### Usando a extensão

1. Clique no ícone da extensão (ou use `Ctrl+Shift+Y`, configurável em
   `chrome://extensions/shortcuts`) para abrir ou fechar o overlay.
2. Navegue pelas 4 abas do painel, cada uma com seu ícone pixelado no
   cabeçalho:
   - **Encontro:** mostra em tempo real o Pokémon adversário, HP, Nature,
     tipos, stats e IVs;
   - **Calculadora:** compara matchups ofensivos e defensivos entre tipos
     simples ou combinações de dois tipos;
   - **Meus Pokémon:** exibe a Party e as caixas do PC, com cards
     expansíveis, IVs, golpes, busca, ordenação e filtros avançados;
   - **Configurações:** ajusta a largura do painel, os avisos de
     atualização (canais estável `main`/beta `develop`), os tooltips e
     lista os atalhos de teclado.

   A tabela de tipos completa fica junto da Calculadora — veja "modo
   full" abaixo.
3. No cabeçalho, além das abas, há os botões de expandir (ícone de
   tabela) e minimizar (`_`), e uma barra de status com um ponto verde
   piscando quando o painel está conectado ao jogo.
4. Atalhos de teclado (valem com o mouse/foco sobre o painel, não na
   página do jogo): `E` Encontro, `C` Calculadora, `M` Meus Pokémon, `,`
   (vírgula) Configurações, `F` expandir/tabela completa, `Esc`
   minimizar/voltar.
5. **Modo full** (botão de expandir ou `F`): o painel ocupa 90% da
   largura da janela. Na Calculadora e no Encontro, a tabela de tipos
   completa aparece ao lado do conteúdo; em Meus Pokémon, a tela vira
   uma grade larga com os cards expandidos. Pressione `Esc`, o próprio
   botão de expandir novamente, ou o botão **VOLTAR** da tabela pra
   sair e voltar ao tamanho anterior.
6. Na aba Configurações: o stepper de largura (`-`/`+`) ajusta o painel
   encaixado entre 250 e 380px; o toggle de tooltips liga/desliga as
   dicas ao passar o mouse em todas as telas (útil pra não atrapalhar
   durante a batalha).
7. Algumas informações dependem dos dados enviados pelo jogo e aparecem
   depois que o personagem ou uma batalha é sincronizada.

Toda alteração de código bumpa a versão em `manifest.json`, pra confirmar
que o reload pegou os arquivos novos.

## Arquivos

| Arquivo | Contexto | Papel |
|---|---|---|
| `background.js` | service worker | Injeta `content.js` e `interceptor.js` no clique/atalho, e automaticamente ao carregar uma página em `infinitymmo.net` (via `host_permissions`) |
| `interceptor.js` | MAIN world da página | Hook do `window.fetch` |
| `content.js` | isolated world | Overlay, abas, foco/desfoco automático |
| `index.html`/`app.js` | iframe | Calculadora de tipos |
| `battle.html`/`battle.js` | iframe | Dados do encontro atual |
| `chart.html`/`chart.js` | iframe | Tabela completa e filtros de tipos |
| `myPokemons.html`/`myPokemons.js` | iframe | Party, caixas, detalhes, ordenação e filtros de Pokémon |
| `components/` | compartilhado | Componentes visuais e controles reutilizados pelas telas |
| `data/` | compartilhado | Constantes e persistência das configurações da extensão |

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
- `data.foe` presente → foca na aba Encontro (abrindo o overlay se estiver
  colapsado). Não existe mais um estado de "fim de batalha" separado:
  `battle.js` guarda o último `foe` recebido e só mescla campos novos por
  cima dele, porque respostas de turno (ex: atacar) nem sempre reenviam o
  objeto `foe` completo.
- `data.party`/`data.pc` presente (sync de personagem) → não abre o overlay
  nem troca de aba sozinho, porque esse payload chega passivamente sempre
  que o jogo sincroniza (não só quando o jogador abre a tela de time).
- `data.state.over === true` (fim de luta) → se a aba Encontro tinha sido
  focada automaticamente pro `data.foe`, volta pra aba que estava aberta
  antes (`overlay.dataset.preBattleView`). Usado só pra decidir a aba do
  overlay — `battle.js` ignora esse campo de propósito, pra não virar um
  estado de tela separado ali (ver histórico do bug de "resultado").

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
