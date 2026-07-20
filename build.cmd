@echo off
REM Tus enjeksiyon yardimcisini ve tray/duzenleyici uygulamasini derler.
REM .NET Framework Windows ile geldigi icin derleyici kurulumu gerekmez.
REM WebView2 sarmalayicilari tray\lib altinda projeyle birlikte gelir.
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

if not exist "%~dp0tray\Microsoft.Web.WebView2.WinForms.dll" call "%~dp0tray\fetch-webview2.cmd"
if errorlevel 1 exit /b 1

echo [1/2] InputHelper...
"%CSC%" /nologo /target:exe /platform:x64 /optimize+ /out:"%~dp0helper\InputHelper.exe" "%~dp0helper\InputHelper.cs"
if errorlevel 1 (echo HATA & exit /b 1)

echo [2/2] Tray + Editor...
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Core.dll /r:"%~dp0tray\Microsoft.Web.WebView2.Core.dll" /r:"%~dp0tray\Microsoft.Web.WebView2.WinForms.dll" /out:"%~dp0tray\SurecutDeck.exe" "%~dp0tray\TrayApp.cs" "%~dp0tray\EditorForm.cs"
if errorlevel 1 (echo HATA & exit /b 1)

echo Tamam.
