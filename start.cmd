@echo off
REM Tray uygulamasini baslatir; node host'unu tray kendi cocuk sureci olarak yonetir.
cd /d "%~dp0"
if not exist "helper\InputHelper.exe" call build.cmd
if not exist "tray\SurecutDeck.exe" call build.cmd
start "" "%~dp0tray\SurecutDeck.exe"
