# Tasinabilir bir surum paketler: indiren kisinin Node kurmasi gerekmez.
#
#   powershell -ExecutionPolicy Bypass -File package.ps1
#
# Uretilen klasor kendi kendine yeter. Node calisma zamani icine kopyalanir
# (87 MB'nin buyuk kismi odur); tray, yanindaki runtime\node.exe'yi gorurse
# onu kullanir, gormezse PATH'teki node'a duser. Yani depodan calistiran
# gelistirici icin hicbir sey degismiyor.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$name = "surecut-deck-$version-win-x64"
$dist = Join-Path $root "dist\$name"

Write-Host "[1/5] Yardimcilar derleniyor..."
& cmd.exe /c "`"$root\build.cmd`"" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'build.cmd basarisiz' }

Write-Host "[2/5] Klasor hazirlaniyor..."
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dist | Out-Null

# Calistirmak icin gereken her sey. data\ ve dist\ disarida: biri kullanicinin
# kendi yapilandirmasi, digeri bu betigin ciktisi.
$files = @(
  'server.js', 'package.json', 'start.cmd', 'README.md', 'LICENSE'
)
foreach ($f in $files) {
  $src = Join-Path $root $f
  if (Test-Path $src) { Copy-Item $src $dist }
}

foreach ($d in @('public', 'helper', 'tray', 'node_modules')) {
  $src = Join-Path $root $d
  if (Test-Path $src) { Copy-Item $src (Join-Path $dist $d) -Recurse }
}

Write-Host "[3/5] Gereksiz dosyalar ayikllaniyor..."
# Kaynak dosyalar ve kullanici verisi pakete girmesin.
Get-ChildItem (Join-Path $dist 'helper') -Filter *.cs -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem (Join-Path $dist 'tray') -Filter *.cs -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem (Join-Path $dist 'tray') -Filter *.cmd -ErrorAction SilentlyContinue | Remove-Item -Force
Remove-Item (Join-Path $dist 'public\icons') -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[4/5] Node calisma zamani kopyalaniyor..."
$node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path (Join-Path $dist 'runtime') | Out-Null
Copy-Item $node (Join-Path $dist 'runtime\node.exe')

# Paketten calistiranin ne yaptigini bilmesi icin kisa bir not.
@"
Surecut Deck $version

Calistirmak icin: start.cmd

Node kurmaniz gerekmiyor, calisma zamani runtime\ klasorunde geliyor.
Ilk calistirmada sistem tepsisinde bir simge belirir; ona tiklayarak
eslestirme kodunu ve tabletten acilacak adresi gorursunuz.

Windows SmartScreen bir uyari gosterebilir: bu paket imzali degil.
Kaynak kod: https://github.com/sanwhere/surecut-deck
"@ | Set-Content (Join-Path $dist 'OKUBENI.txt') -Encoding UTF8

Write-Host "[5/5] Arsiv olusturuluyor..."
$zip = Join-Path $root "dist\$name.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $dist -DestinationPath $zip -CompressionLevel Optimal

$mb = (Get-Item $zip).Length / 1MB
Write-Host ("Hazir: dist\{0}.zip  ({1:N0} MB)" -f $name, $mb)
