@echo off
setlocal enabledelayedexpansion
title GIT AUTO DEPLOY
color 0A

echo ==========================================
echo GIT AUTO DEPLOY
echo ==========================================
echo.

:: CONFIG
set REPO_URL=https://github.com/SaimonSantosOficial/menuus.git

:: IR PARA PASTA DO SCRIPT
cd /d %~dp0

echo [1/6] Verificando Git...

git --version >nul 2>&1
if errorlevel 1 (
    echo Git nao instalado!
    pause
    exit
)

echo [2/6] Inicializando repositorio (se necessario)...

if not exist .git (
    git init
)

echo [3/6] Configurando branch main...

git branch -M main

echo [4/6] Configurando remote...

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    git remote add origin %REPO_URL%
) else (
    git remote set-url origin %REPO_URL%
)

echo [5/6] Adicionando arquivos...

git add .

echo [6/6] Commit...

set MSG=auto deploy %date% %time%

git commit -m "%MSG%" >nul 2>&1

if errorlevel 1 (
    echo Nenhuma alteracao para commit.
)

echo Enviando para GitHub...

git pull origin main --rebase >nul 2>&1
git push -u origin main

if errorlevel 1 (
    echo Tentando push forcado seguro...
    git push --force-with-lease origin main
)

echo.
echo ==========================================
echo DEPLOY FINALIZADO
echo ==========================================
pause