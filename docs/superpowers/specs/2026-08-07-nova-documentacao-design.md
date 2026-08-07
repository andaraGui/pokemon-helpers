# Design: nova documentação e renomeação para "Infinity MMO Extension"

Data: 2026-08-07 · Branch: `docs/nova-documentacao` (criada a partir de `feat/configuracoes-editaveis`)

## Objetivo

Refazer toda a documentação do repositório após a mudança de URL
(`github.com/andaraGui/pokemon-infinity-mmo-extension`) e de nome da
extensão (**Infinity MMO Extension**), separando documentação de usuário,
de desenvolvedor e de contexto para IA, sem repetição de conteúdo.

## Estrutura final

| Arquivo | Público | Conteúdo |
|---|---|---|
| `README.md` | Usuário final (PT-BR) | O que é, sumário com links, instalação (ZIP/Git), listagem completa de funcionalidades e configurações, atualização, placeholders de imagem, links para os outros docs |
| `docs/DEVELOPMENT.md` | Desenvolvedor (PT-BR) | Arquitetura, tabela de arquivos, interceptação de fetch, fluxo DevTools, manifests Chrome/Firefox, build/release, convenções |
| `AGENTS.md` | Agentes de IA (EN) | Contexto curto do projeto, mapa de layout, convenções críticas e ponteiros para README/DEVELOPMENT — sem duplicar o conteúdo deles |

Regra anti-duplicação: cada informação vive em um único arquivo; os outros
linkam. README não explica arquitetura; DEVELOPMENT não explica uso;
AGENTS só resume e aponta.

## Decisões (pontos que poderiam ser tomados de outra forma)

1. **Nome de exibição da extensão:** "Infinity MMO Extension" (corrige o
   typo atual "IfinityMMO Helper") em `manifest.json` e
   `manifest.firefox.json`.
2. **ID Gecko do Firefox NÃO muda** (`ifinitymmo-helper@andaragui`):
   trocar o ID faz o Firefox tratar como outra extensão e perder as
   configurações salvas dos usuários. Mantido com comentário no doc de
   desenvolvimento.
3. **Identificadores internos de código NÃO mudam** (`pokemon-helper-style`,
   `pkmn-helper-battle-data`, prefixo de console `[Pokemon Helper]` etc.):
   são código, não configuração/documentação; renomear arrisca quebrar
   comportamento sem ganho para o usuário. Escopo da renomeação =
   manifests, scripts de build, URLs e docs.
4. **URLs funcionais atualizadas:** `host_permissions` dos dois manifests e
   `background.js` (verificador de atualização) passam a apontar para
   `raw.githubusercontent.com/andaraGui/pokemon-infinity-mmo-extension/...`.
   GitHub redireciona o nome antigo, mas o `host_permissions` só autoriza a
   URL literal — por isso a troca é obrigatória, não cosmética.
5. **Zips de build renomeados** para `infinity-mmo-extension-chrome.zip` /
   `-firefox.zip` nos scripts `scripts/build-*.sh`.
6. **Versão do manifest NÃO é bumpada** neste trabalho: convenção do repo
   é bumpar só em release. A frase contraditória do README antigo ("toda
   alteração bumpa a versão") é removida — a regra correta fica só no
   DEVELOPMENT.md.
7. **Doc de desenvolvedor em `docs/DEVELOPMENT.md`** (nome de arquivo em
   inglês, conteúdo em PT-BR, seguindo a convenção do repo: docs em
   português, identificadores em inglês).
8. **Listagem de funcionalidades vem do código-fonte**, não do README
   antigo: um subagente inventaria telas/configurações direto de
   `content.js`, `components/settings-panel.js`, `battle.js`,
   `myPokemons.js`, `app.js`, `chart.js`, para garantir cobertura de TODAS
   as funcionalidades.
9. **Placeholders de imagem** no formato
   `![descrição do print](docs/images/NOME.png)` + comentário
   `<!-- TODO imagem: instruções do print -->`, concentrados na seção de
   uso do README; pasta `docs/images/` criada com `.gitkeep`.
10. **Execução via subagentes** com modelos de menor capacidade (Sonnet
    para inventário/escrita, Haiku para edições mecânicas), em 4 fases:
    inventário + renomeação (paralelo) → README + DEVELOPMENT (paralelo) →
    AGENTS.md → revisão de consistência.
11. **Commits locais apenas, sem push**, na branch `docs/nova-documentacao`
    criada a partir de `feat/configuracoes-editaveis` (que contém o painel
    de configurações editáveis ainda não mergeado em develop).
