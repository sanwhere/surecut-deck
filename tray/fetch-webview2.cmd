@echo off
REM WebView2 sarmalayici ikililerini NuGet'ten indirir.
REM Depoya konmuyorlar; ilk derlemede build.cmd bunu kendisi cagirir.
REM
REM DLL'ler exe'nin YANINDA olmali. Alt klasore koyarsan .NET onlari
REM calisma zamaninda bulamaz ve duzenleyici penceresi sessizce acilmaz.

setlocal
set VER=1.0.3485.44
set DIR=%~dp0
set TMP=%TEMP%\wv2-%VER%

if exist "%DIR%Microsoft.Web.WebView2.WinForms.dll" (
  echo WebView2 zaten var.
  exit /b 0
)

echo WebView2 %VER% indiriliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$t='%TMP%'; New-Item -ItemType Directory -Force -Path $t | Out-Null;" ^
  "Invoke-WebRequest -Uri 'https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/%VER%' -OutFile \"$t\p.zip\" -UseBasicParsing;" ^
  "Expand-Archive -Force \"$t\p.zip\" \"$t\x\";" ^
  "Copy-Item \"$t\x\lib\net462\Microsoft.Web.WebView2.Core.dll\" '%DIR%' -Force;" ^
  "Copy-Item \"$t\x\lib\net462\Microsoft.Web.WebView2.WinForms.dll\" '%DIR%' -Force;" ^
  "Copy-Item \"$t\x\runtimes\win-x64\native\WebView2Loader.dll\" '%DIR%' -Force;" ^
  "Remove-Item $t -Recurse -Force"

if errorlevel 1 (echo INDIRME BASARISIZ & exit /b 1)
echo Tamam.
