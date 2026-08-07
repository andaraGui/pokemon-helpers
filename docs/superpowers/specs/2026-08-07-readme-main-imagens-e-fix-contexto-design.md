# Spec: README só `main`, imagens reais e fix do "Extension context invalidated"

Data: 2026-08-07 · Branch de trabalho: `docs/readme-main-imagens-e-fix-contexto` (a partir de `origin/main`)

Três correções independentes, todas pequenas, agrupadas num único PR para `main`.

## 1. README: remover escolha de branch (usuário final usa só `main`)

Contexto: o fluxo de beta para o usuário é o toggle "Canal beta" nas
Configurações, não uma troca de branch. Decisão do dono do projeto: o README
não menciona `develop` nem explica o mecanismo de branch do toggle.

Mudanças no `README.md`:

- **Opção 1 (ZIP)**: remover o passo 2 ("Escolha a versão desejada no seletor
  de branch" com as descrições de `main`/`develop`). Renumerar os passos
  seguintes. O link do passo 1 já abre o repositório na `main`.
- **Opção 2 (Git)**: remover o passo 4 ("Escolha a branch que deseja usar…
  `git switch develop`… `git switch main`"). Renumerar.
- **Atualização**:
  - ZIP: "baixe novamente o ZIP da branch desejada (`main` ou `develop`)" →
    "baixe novamente o ZIP".
  - Git: bloco `git switch develop # ou: git switch main` + `git pull` →
    apenas `git pull`; remover "confirme que está na branch desejada".
  - Frase final: "…versão mais nova disponível na branch escolhida" →
    "…versão mais nova disponível".
- **Configurações → Canal beta** (linhas ~237-238): trocar "Compara a versão
  instalada contra a branch `develop` em vez da `main`" por descrição sem
  branch: o toggle faz os avisos de atualização considerarem também versões
  beta (em teste). Nenhuma outra menção a `develop` deve sobrar no README
  (a referência a `docs/DEVELOPMENT.md` na seção de desenvolvimento fica).

Sem mudança de código neste item: o comportamento do toggle
(`background.js:152`) permanece como está.

## 2. README: imagens reais em `docs/images/`

`docs/images/` só tem `.gitkeep`; os sete PNGs referenciados nunca foram
commitados — por isso aparecem quebrados no GitHub. As capturas já existem em
`~/Pictures/Screenshots` (lote de 2026-08-07). Mapeamento:

| Destino em `docs/images/` | Origem (`Screenshot From 2026-08-07 …`) |
|---|---|
| `capa-overlay.png` | `15-29-11` (overlay encaixado ao lado da batalha) |
| `aba-encontro.png` | `16-05-44` (Pidgey, fraquezas e melhor jogada) |
| `aba-calculadora.png` | `15-27-15` (golpe NRM selecionado, encaixado) |
| `tabela-tipos.png` | recorte da região da tabela de `15-26-09` |
| `modo-full.png` | `15-26-09` inteiro (tabela + calculadora ao lado) |
| `aba-meus-pokemon.png` | `15-03-14` (time expandido, detalhes abertos) |
| `tela-configuracoes.png` | `15-03-50` |

- O recorte de `tabela-tipos.png` usa ImageMagick se disponível; senão, usar
  `15-26-09` inteiro também ali (aceitável, documentar no PR).
- Ajustar a legenda de `aba-meus-pokemon.png`: de "com filtros avançados
  abertos" para algo fiel à captura (grupos e detalhes abertos).
- `.gitkeep` pode ser removido quando as imagens entrarem.
- As imagens só aparecem no GitHub depois do merge na `main`.

## 3. Fix: warn repetido "Não foi possível carregar habilidades: Extension context invalidated"

Causa raiz: após recarregar/atualizar a extensão sem recarregar a aba do
jogo, o content script antigo segue vivo com o contexto da extensão morto.
Toda chamada a `chrome.storage` lança "Extension context invalidated";
`PokemonAbilityInfo.hydrate()` roda a cada render (`battle.js:496`,
`myPokemons.js:517`) e repete o warn indefinidamente.

Correção — guard central em `data/extension-storage.js`:

- Nova checagem interna `isContextValid()` → `Boolean(chrome.runtime?.id)`.
- `read(key, fallback)`: com contexto inválido, devolve o fallback sem tocar
  o `chrome.storage`.
- `write(key, value)`: com contexto inválido, vira no-op (resolve sem erro).
- Na primeira detecção, um único `console.info` orienta: "extensão foi
  atualizada/recarregada — recarregue a página do jogo" (flag interna para
  não repetir).
- Nenhuma mudança nos consumidores (`ability-info.js` etc. continuam iguais;
  o catch existente deixa de ser acionado por esse cenário).

Fora de escopo: banner visual no overlay pedindo reload da página (possível
melhoria futura).

## Verificação

1. `grep -iE "develop|branch" README.md` não retorna instruções de escolha de
   branch para o usuário final.
2. As sete imagens existem em `docs/images/` e os nomes batem com as
   referências do README (`grep -oE 'docs/images/[a-z-]+\.png' README.md`).
3. Manual: com a extensão carregada e a página do jogo aberta, recarregar a
   extensão em `chrome://extensions` sem recarregar a página → no console da
   página aparece no máximo um aviso informativo, sem warns repetidos de
   "Extension context invalidated"; após recarregar a página, tudo volta ao
   normal.
