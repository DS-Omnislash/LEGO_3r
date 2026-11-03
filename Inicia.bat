@echo off
chcp 65001 >nul
title SUPERPOWERED - Seguiment FLL
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No s'ha trobat Node.js. Instal·leu-lo des de https://nodejs.org ^(versio LTS^) i torneu-ho a provar.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Primera execucio: instal·lant dependencies ^(nomes cal fer-ho un cop, requereix internet^)...
  call npm install
)
echo.
echo  Obrint l'aplicacio a http://localhost:5173
echo  Deixeu aquesta finestra oberta mentre feu servir l'aplicacio. Tanqueu-la per aturar-la.
echo.
call npm start
pause
