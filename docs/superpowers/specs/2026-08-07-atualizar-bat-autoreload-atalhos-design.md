# Spec: atualizar.bat, auto-reload da extensão e novos atalhos padrão

Data: 2026-08-07 · Branch: `feat/atualizar-bat-autoreload-atalhos` (a partir de
`docs/readme-main-imagens-e-fix-contexto`, que contém o README novo e o guard
de contexto invalidado)

Objetivo: atualizar a extensão vira "duplo clique no `atualizar.bat` + F5 na
página". A primeira instalação continua 100% manual (README como está). Sem
`instalar.bat`, sem protocolo `pkmn-helper://`, sem mudança no aviso de
atualização (continua só aviso). De carona, os atalhos padrão mudam para
1/2/3/4 e `` ` ``.

## 1. `atualizar.bat` (raiz do repo, Windows)

Script de duplo clique para quem instalou via Git. Público: jogadores Windows
sem familiaridade com terminal.

Comportamento, na ordem:

1. `@echo off`, `chcp 65001 >nul` (acentos no cmd), `cd /d "%~dp0"` (roda na
   pasta do script, independente de onde foi chamado).
2. Git ausente (`where git` falha) → mensagem: instale o Git em
   git-scm.com/download/win e rode de novo. Encerra com `pause`.
3. Sem `.git` na pasta → mensagem: esta pasta não foi instalada com Git; use
   o fluxo de atualização por ZIP do README. Encerra com `pause`.
4. Branch atual ≠ `main` → `git switch main`; se falhar, mensagem legível e
   `pause`.
5. `git pull --ff-only`. Falha → mensagem: não foi possível atualizar
   automaticamente (alterações locais ou histórico divergente); baixe o ZIP
   pelo README ou peça ajuda. `pause`.
6. Sucesso → mensagem: "Atualizado! A extensão vai se recarregar sozinha em
   alguns instantes. Depois, recarregue a página do jogo (F5)." `pause`.

Toda mensagem em pt-BR. O script nunca fecha a janela sem `pause` (duplo
clique abriria e fecharia a janela instantaneamente).

Arquivo novo `.gitattributes` na raiz com `*.bat text eol=crlf` (o script
precisa de CRLF no Windows independente da config de git do usuário).

Limite conhecido e aceito: o `.bat` não recarrega o Chrome — isso é o item 2.

## 2. Auto-reload da extensão ao detectar versão nova no disco

Numa extensão descompactada, `fetch(chrome.runtime.getURL(<manifest>))` lê o
arquivo do disco, enquanto `chrome.runtime.getManifest()` devolve o que está
carregado na memória. O service worker compara as duas versões e se recarrega
quando o disco está mais novo.

Em `background.js`:

- Nova função `checkDiskVersion()`:
  - Resolve `manifestName` com a mesma lógica de `checkForUpdates()`
    (`browser_specific_settings` → `manifest.firefox.json`, senão
    `manifest.json`).
  - `fetch(chrome.runtime.getURL(manifestName), { cache: 'no-store' })`,
    parse do JSON, valida a versão com o mesmo regex de `checkForUpdates`
    (`/^\d+(\.\d+)*$/`).
  - `compareVersions(diskVersion, installedVersion) > 0` →
    `chrome.runtime.reload()`. Igual ou menor (ex.: dev trocando de branch)
    → não faz nada; estritamente maior evita loop de reload e downgrade
    acidental.
  - Qualquer erro (fetch falhou, JSON inválido — ex.: pull em andamento) →
    silencioso; a próxima checagem tenta de novo.
  - Throttle interno de 5 segundos (timestamp em variável do SW) para
    eventos de foco em rajada.
- Gatilhos:
  - Mensagem nova `pkmn-helper-check-disk-version` no
    `chrome.runtime.onMessage` existente.
  - No alarme de update existente (`UPDATE_ALARM`), chamar
    `checkDiskVersion()` junto — carona, sem alarme novo. A checagem por
    foco funciona mesmo com os avisos de atualização desligados.

Em `content.js`:

- No documento do jogo: enviar `pkmn-helper-check-disk-version` via
  `chrome.runtime.sendMessage` quando a página ganha visibilidade
  (`visibilitychange` → `visible`) e uma vez no carregamento do script.
  Registrado com a mesma guarda de listener único usada pelos atalhos
  (`window.__pkmnHelper...`), e envolto em try/catch silencioso (se o
  contexto já estiver invalidado, o sendMessage lança — ignorar; o guard de
  storage já orienta o usuário a dar F5).

Fluxo completo do usuário: `atualizar.bat` → volta ao navegador (foco na aba
dispara a checagem) → extensão se recarrega sozinha → o content script antigo
fica com contexto invalidado e o guard (já existente) registra o aviso para
recarregar a página → F5.

Bônus: o fluxo ZIP também se beneficia — extraiu os arquivos novos por cima,
a extensão se recarrega sozinha do mesmo jeito (sem visitar
`chrome://extensions`).

Dependência: a versão do `manifest.json` precisa ser bumpada a cada release —
já é o critério do checador de atualizações do projeto.

Risco conhecido: o comportamento "fetch de recurso reflete o disco" é o
esperado para extensão descompactada, mas será confirmado na verificação
manual. Se não refletir, plano B (fora deste spec): botão "Recarregar
extensão" nas Configurações chamando `chrome.runtime.reload()` via mensagem.

## 3. Novos atalhos padrão: 1/2/3/4 e `` ` ``

Única mudança de código: os valores de `shortcuts` em
`DEFAULT_UI_PREFERENCES` (`data/extension-storage.js`, linhas ~50-58):

| Ação | Antes | Depois |
|---|---|---|
| battle (Encontro) | `e` | `1` |
| calc (Calculadora) | `c` | `2` |
| myPokemons (Meus Pokémon) | `m` | `3` |
| settings (Configurações) | `,` | `4` |
| typeChart (Tabela de tipos) | `t` | `t` (fica) |
| toggleFull (Expandir/recolher) | `f` | `f` (fica) |
| minimize (Minimizar/voltar) | `escape` | `` ` `` (crase) |

Tudo que exibe atalhos (tooltips do header, barra de status
`content.js:722`, painel de Configurações) formata dinamicamente a partir das
preferências — nenhuma outra mudança de código. `` formatCombo('`') `` exibe
`` ` `` corretamente (cai no `key.toUpperCase()`).

README, seção "Atalhos de teclado": atualizar a coluna "Atalho padrão" da
tabela conforme acima (a linha `Ctrl+Shift+Y` do navegador não muda).

Consequências decididas pelo dono:

- Os atalhos são globais e a tecla configurada é consumida (o jogo não a
  vê); confirmado que o infinitymmo.net não usa 1-4 nem `` ` ``.
- Usuários existentes mantêm os atalhos salvos; os novos padrões valem para
  instalação limpa ou "Restaurar atalhos padrão".
- ESC deixa de minimizar por padrão (segue cancelando a gravação de atalho,
  comportamento fixo do recorder).
- A captura `tela-configuracoes.png` passa a mostrar os atalhos antigos na
  seção ATALHOS — recaptura fica a critério do dono, fora deste escopo.

## 4. README: seção "Atualização" reescrita

A seção volta a ser um passo a passo claro, agora com o fluxo novo:

- **Com Git (recomendado):** dê dois cliques em `atualizar.bat` na pasta da
  extensão e aguarde a mensagem de sucesso; a extensão se recarrega sozinha
  em alguns instantes; recarregue a página do jogo (F5). Nota de que rodar
  `git pull` no terminal continua equivalente.
- **Com ZIP:** baixe o ZIP de novo, extraia por cima da pasta usada; a
  extensão se recarrega sozinha; recarregue a página do jogo (F5).
- Manter a menção à checagem automática de versão/faixa de aviso (texto
  atual), sem citar branch (regra do spec anterior continua valendo).

A seção "Instalação" não muda (primeira configuração é sempre manual).

## Verificação

1. Smoke em Node: defaults novos de `shortcuts` presentes em
   `PokemonHelperStorage.DEFAULT_UI_PREFERENCES` e
   `` PokemonHelperShortcutUtils.formatCombo('`') `` → `` ` ``.
2. Revisão de sintaxe do `.bat` (não executável neste Linux); validação
   final no Windows pelo dono.
3. Manual (dono, no Windows/Chrome):
   - `atualizar.bat` em pasta clonada atualiza e mostra a mensagem certa;
     nas condições de erro (sem Git no PATH, pasta sem `.git`, conflito
     local) mostra as mensagens específicas.
   - Auto-reload: com a extensão carregada, bumpar a versão do
     `manifest.json` no disco, focar a aba do jogo → extensão recarrega
     sozinha; F5 restaura o overlay. Confirmar que sem bump nada acontece.
   - Atalhos: após "Restaurar atalhos padrão", 1/2/3/4 trocam de view,
     `` ` `` minimiza, T e F seguem funcionando.
