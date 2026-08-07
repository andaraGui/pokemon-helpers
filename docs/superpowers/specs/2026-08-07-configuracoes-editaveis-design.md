# Configurações editáveis pelo usuário (atalhos, comportamento e telas)

**Data:** 2026-08-07
**Status:** aprovado pelo usuário (brainstorming em 2026-08-07)

## Objetivo

Tornar as configurações da extensão editáveis pelo usuário — principalmente os
atalhos de teclado, hoje fixos no código — e reestruturar a tela de
Configurações do painel em seções, incluindo novas opções de comportamento,
configurações por tela, restaurar padrões e import/export.

## Contexto atual

- Atalhos hardcoded em 5 lugares: `handleShortcut` no `content.js`
  (E, C, M, `,`, T, F, ESC) e repassadores de tecla duplicados em `app.js`,
  `chart.js` e `myPokemons.js` (lista de teclas repetida). A tela de batalha
  (`battle.js`) **não tem** repassador — atalhos não funcionam com o mouse
  sobre ela.
- A tela de Configurações (`buildSettingsPanel` em `content.js`) já existe,
  com largura, tooltips e avisos de atualização; a lista de atalhos é apenas
  informativa.
- Persistência via `chrome.storage.local` em `data/extension-storage.js`
  (`PokemonHelperStorage`), com defaults e getters/setters por chave.

## Decisões de design (aprovadas)

1. **Abordagem A — repassador "burro" + mapa único no shell.** Os iframes não
   conhecem teclas; repassam todo keydown relevante ao shell, que consulta o
   mapa configurado. Fonte única de verdade, sem estado duplicado.
2. Atalhos aceitam **tecla única ou combinações com modificadores**
   (Ctrl/Alt/Shift).
3. Tela de Configurações **reestruturada em seções**, com restaurar padrões,
   novas opções de comportamento, configurações por tela e import/export.

## 1. Modelo de dados

`DEFAULT_UI_PREFERENCES` em `data/extension-storage.js` cresce para:

```js
{
    tooltipsEnabled: true,

    // COMPORTAMENTO
    startView: 'last',            // 'last' | 'battle' | 'calc' | 'myPokemons'
    startCollapsed: 'remember',   // 'remember' | 'collapsed' | 'open'
    autoSwitchToBattle: true,     // troca automática pra aba Encontro ao começar batalha

    // ATALHOS: ação → combinação normalizada
    shortcuts: {
        battle: 'e',
        calc: 'c',
        myPokemons: 'm',
        settings: ',',
        typeChart: 't',
        toggleFull: 'f',
        minimize: 'escape'
    },

    // TELAS
    screens: {
        myPokemons: {
            expandPokemonByDefault: false,  // cards já abertos ao carregar
            expandGroupsByDefault: true     // grupos já abertos
        },
        battle: {                           // liga/desliga cada seção da tela
            showStatChanges: true,          // atributos alterados (seu/oponente)
            showWeaknesses: true,           // FRAQUEZAS DELE
            showFoeMoves: true,             // GOLPES DELE
            showPokeballs: true,            // POKÉBOLAS
            showIvs: true,                  // IVS / STATS
            showMyMoves: true               // SEUS GOLPES
        }
    }
}
```

**Formato da combinação:** string normalizada — modificadores em ordem fixa
(`ctrl`, `alt`, `shift`, `meta`) seguidos da tecla minúscula (`event.key`),
separados por `+`. Exemplos: `"t"`, `"ctrl+shift+e"`, `"escape"`, `","`.

**Regras de persistência:**

- `shortcuts` é sempre gravado por inteiro (nunca parcial).
- Na leitura, `shortcuts` e `screens` fazem **merge profundo** com os
  defaults (o merge raso atual do `read()` substituiria o objeto aninhado
  inteiro). Assim, se uma versão futura adicionar ação/tela nova, configs
  salvas antigas não deixam ações sem tecla nem telas sem default.
- Nomes de ação são estáveis; mudar a tecla default de uma ação não invalida
  configs salvas.

## 2. Fluxo de atalhos

1. **Novo componente compartilhado `components/shortcut-forwarder.js`**,
   incluído nas quatro páginas de iframe (`index.html`, `chart.html`,
   `myPokemons.html`, `battle.html`). Substitui os três repassadores
   duplicados e adiciona o que faltava na batalha. Comportamento: em todo
   `keydown` fora de INPUT/TEXTAREA, envia ao parent
   `postMessage({ type: 'panel-shortcut', key, ctrl, alt, shift, meta })` —
   sem filtrar teclas (o filtro é do shell).
2. **`content.js`**: `handleShortcut` recebe o evento serializado (do
   postMessage ou do keydown direto no container), normaliza para a string de
   combinação e consulta um **mapa reverso** `combinação → ação` construído a
   partir de `uiPreferences.shortcuts`. O switch interno passa a operar sobre
   nomes de ação (`battle`, `calc`, `typeChart`, `toggleFull`, `minimize`,
   ...), preservando a lógica atual de cada ação (T expande com a tabela,
   ESC desmaximiza ou minimiza, etc.).
3. O mapa é carregado no `build()` e mantido atualizado via
   `chrome.storage.onChanged` — mudanças na tela de config valem
   imediatamente, sem recarregar a página.
4. O payload antigo (`{ key }` string) não precisa de compatibilidade — shell
   e iframes são atualizados juntos no mesmo release.

## 3. Nova tela de Configurações

`buildSettingsPanel` sai do `content.js` para um novo
`components/settings-panel.js` (o content.js já é grande e essa é a maior
parte nova). Visual no tema pixel atual, com os cabeçalhos `ph-set-head`
existentes. Seções, nesta ordem:

| Seção | Conteúdo |
|---|---|
| **PAINEL** | Largura (stepper) e tooltips — como hoje |
| **COMPORTAMENTO** | View inicial (seleção), estado ao abrir (seleção), auto-troca pra Encontro (toggle) |
| **ATALHOS** | Grade ação → tecla com captura; "Restaurar atalhos padrão"; botão existente de atalho do navegador |
| **TELAS** | Subseção Meus Pokémon (2 toggles) e subseção Batalha (6 toggles) |
| **ATUALIZAÇÕES** | Avisos + canal beta — como hoje |
| **DADOS** | Exportar config, importar config, "Restaurar tudo" |

### Captura de atalho

- Cada tecla na grade é um **botão**: ao clicar, entra em modo captura
  ("pressione a combinação…").
- O próximo `keydown` válido vira o atalho: tecla única ou
  Ctrl/Alt/Shift/Meta + tecla.
- `keydown` só de modificador é ignorado (captura continua).
- **ESC cancela a captura**; clicar fora também. Consequência: ESC não pode
  ser atribuído a outra ação pela captura — só volta via "Restaurar atalhos
  padrão". Documentado num hint na própria UI.
- **Duplicata recusada** na hora, com aviso mostrando qual ação já usa a
  combinação.
- Combinações reservadas do navegador (Ctrl+W, Ctrl+T…) não são bloqueadas,
  mas um hint avisa que podem não chegar à página.
- Cada atribuição grava o mapa inteiro via `PokemonHelperStorage`.

### Comportamento (novas opções)

- **View inicial** (`startView`): qual aba o painel mostra ao construir.
  `'last'` mantém o comportamento atual (view persistida em
  `overlaySettings.view`); os demais valores forçam a aba escolhida.
- **Estado ao abrir** (`startCollapsed`): `'remember'` mantém o
  comportamento atual (`overlaySettings.collapsed`); `'collapsed'` sempre
  começa na bolha; `'open'` sempre começa aberto.
- **Auto-troca no encontro** (`autoSwitchToBattle`): quando desligado, o
  shell não troca sozinho para a aba Encontro ao detectar batalha (a lógica
  de `preBattleView`/retorno automático fica inerte).

### Telas

- **Meus Pokémon**: os defaults de expansão valem como estado *inicial*
  (primeira carga / grupos e pokémon ainda não conhecidos pelo
  `UI_STATE`); toggles manuais do usuário continuam mandando depois, como
  hoje.
- **Batalha**: seção desligada simplesmente não renderiza.
- Cada iframe lê `getUiPreferences()` no load e escuta
  `chrome.storage.onChanged`, re-renderizando quando `screens` muda.

### Dados

- **Exportar**: baixa um `.json` com apenas as chaves de preferência
  (`uiPreferences`, `updatePreferences`, `overlaySettings`) — nunca caches
  de dados (pokédex, golpes, habilidades…).
- **Importar**: file picker; valida que é JSON e filtra apenas chaves/campos
  conhecidos (validação por schema simples). Qualquer coisa inválida →
  nada é aplicado e o erro aparece na tela. Aviso de que sobrescreve as
  configurações atuais.
- **Restaurar tudo**: com confirmação; restaura `uiPreferences`,
  `updatePreferences` e os campos de aparência de `overlaySettings`
  (largura/posição), mantendo o painel aberto.

## 4. Infra e compatibilidade

- Arquivos novos (`components/settings-panel.js`,
  `components/shortcut-forwarder.js`) entram nos **dois manifests**
  (`manifest.json`, `manifest.firefox.json` — `web_accessible_resources` se
  necessário) e nos arrays `FILES` de `scripts/build-chrome.sh` e
  `scripts/build-firefox.sh` (regra do AGENTS.md).
- Usuários existentes: `uiPreferences` salvo só com `tooltipsEnabled` recebe
  todos os novos campos via merge com defaults na leitura. Sem migração de
  dados.
- Sem mudança no fluxo do `interceptor.js` nem no duck-typing de payloads.

## 5. Verificação (manual — projeto sem suite de testes)

Carregar a extensão unpacked e verificar:

1. Remapear cada uma das 7 ações — com tecla única e com modificador — e
   confirmar que o novo atalho funciona e o antigo deixa de funcionar.
2. Atalhos funcionando com foco/mouse em cada um dos 4 iframes e no shell
   (incluindo a tela de batalha, que ganha o repassador).
3. Duplicata recusada com aviso correto; ESC cancela captura; modificador
   sozinho não conclui captura.
4. "Restaurar atalhos padrão" e "Restaurar tudo" (com confirmação).
5. Export → import round-trip preserva tudo; arquivo inválido é recusado sem
   aplicar nada.
6. Toggles de seção da Batalha refletidos em batalha real; auto-troca
   desligada não muda de aba ao entrar em batalha.
7. Expansão default em Meus Pokémon (4 combinações) valendo só como estado
   inicial.
8. View inicial e estado ao abrir nas 3 variações cada.
9. Regressão: perfil sem config salva se comporta exatamente como hoje
   (defaults idênticos aos atuais).

## Fora de escopo

- Atalho global do navegador (já resolvido pela página de atalhos do
  Chrome/Firefox, acessível pelo botão existente).
- Sincronização entre dispositivos (`storage.sync`).
- Configs por tela além de Meus Pokémon e Batalha (Calculadora e Tabela não
  têm estado configurável relevante hoje).
