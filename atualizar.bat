@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"
if errorlevel 1 (
    echo Nao foi possivel entrar na pasta do script.
    goto :fim
)

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
    git checkout main
    if errorlevel 1 (
        echo.
        echo Nao foi possivel voltar para a branch main.
        echo Baixe o ZIP pelo README ou peca ajuda.
        goto :fim
    )
)

for /f "delims=" %%h in ('git rev-parse HEAD') do set BEFORE_HEAD=%%h

echo Baixando a versao mais recente...
git pull --ff-only
if errorlevel 1 (
    echo.
    echo Nao foi possivel atualizar automaticamente ^(alteracoes locais
    echo ou historico divergente^).
    echo Baixe o ZIP pelo README ou peca ajuda.
    goto :fim
)

for /f "delims=" %%h in ('git rev-parse HEAD') do set AFTER_HEAD=%%h

echo.
echo ============================================
if "%BEFORE_HEAD%"=="%AFTER_HEAD%" (
    echo Voce ja esta na versao mais recente.
) else (
    echo Atualizado! A extensao vai se recarregar
    echo sozinha em alguns instantes.
    echo.
    echo Depois, recarregue a pagina do jogo (F5).
)
echo ============================================

:fim
echo.
pause
