@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Infinity MMO Extension - Atualizador
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo O Git nao foi encontrado neste computador.
    echo.
    echo Instale o Git em: https://git-scm.com/download/win
    echo Depois execute este arquivo de novo.
    goto :fim
)

if not exist ".git" (
    echo Esta pasta nao foi instalada com Git.
    echo.
    echo Use o fluxo de atualizacao por ZIP descrito no README:
    echo baixe o ZIP de novo e extraia por cima desta pasta.
    goto :fim
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
if not "%BRANCH%"=="main" (
    echo Voltando para a versao estavel ^(branch main^)...
    git switch main
    if errorlevel 1 (
        echo.
        echo Nao foi possivel voltar para a branch main.
        echo Baixe o ZIP pelo README ou peca ajuda.
        goto :fim
    )
)

echo Baixando a versao mais recente...
git pull --ff-only
if errorlevel 1 (
    echo.
    echo Nao foi possivel atualizar automaticamente ^(alteracoes locais
    echo ou historico divergente^).
    echo Baixe o ZIP pelo README ou peca ajuda.
    goto :fim
)

echo.
echo ============================================
echo Atualizado! A extensao vai se recarregar
echo sozinha em alguns instantes.
echo.
echo Depois, recarregue a pagina do jogo (F5).
echo ============================================

:fim
echo.
pause
