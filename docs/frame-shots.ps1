# Ekran goruntulerini tablet govdesinin icine oturtur.
#
# HTML rehberde cerceve CSS ile ciziliyor, ama Markdown'da (README) CSS yok.
# Bu yuzden cerceve gorselin ICINE gomuluyor; boylece GitHub'da da, baska her
# yerde de ayni sekilde gorunuyor.
#
#   powershell -ExecutionPolicy Bypass -File docs\frame-shots.ps1

Add-Type -AssemblyName System.Drawing

$docs   = Split-Path -Parent $MyInvocation.MyCommand.Path
$src    = Join-Path $docs 'shots'
$out    = Join-Path $src 'framed'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# Sadece tablet ekranlari cerceveleniyor; masaustu goruntulerinde
# zaten gercek pencere kenarligi var.
$tabletShots = @(
  '01-deck.png','02-themes.png','03-editmode.png','04-editor.png',
  '05-action.png','06-touchpad.png','07-menu.png','08-light.png',
  '20-gauges.png','21-gauge-editor.png'
)

$padX = 34    # yanlarda cerceve kalinligi
$padY = 26    # ustte/altta
$r    = 26    # dis kose yaricapi

function New-RoundedPath($x, $y, $w, $h, $rad) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $rad * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

foreach ($name in $tabletShots) {
  $inPath = Join-Path $src $name
  if (-not (Test-Path $inPath)) { Write-Host "atlandi (yok): $name"; continue }

  $shot = [System.Drawing.Image]::FromFile($inPath)
  $W = $shot.Width + $padX * 2
  $H = $shot.Height + $padY * 2

  $bmp = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::Transparent)

  # govde: hafif egimli koyu gradyan, metalik bir his icin
  $body = New-RoundedPath 0 0 $W $H $r
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point 0, 0),
    (New-Object System.Drawing.Point $W, $H),
    [System.Drawing.Color]::FromArgb(255, 62, 69, 82),
    [System.Drawing.Color]::FromArgb(255, 32, 38, 47))
  $g.FillPath($brush, $body)

  # ust kenarda ince acik cizgi: govdeye hacim verir
  $hl = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(46, 255, 255, 255)), 1
  $g.DrawPath($hl, (New-RoundedPath 0.5 0.5 ($W - 1) ($H - 1) $r))

  # ekran yuvasi
  $screen = New-RoundedPath $padX $padY $shot.Width $shot.Height 5
  $g.SetClip($screen)
  $g.DrawImage($shot, $padX, $padY, $shot.Width, $shot.Height)
  $g.ResetClip()

  # kamera ve guc dugmesi: tabletin yonu okunsun
  $dark = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 20, 26))
  $g.FillEllipse($dark, [int]($padX / 2) - 3, [int]($H / 2) - 3, 6, 6)
  $soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
  $g.FillRectangle($soft, $W - 10, [int]($H / 2) - 24, 3, 48)

  $g.Dispose()
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose(); $shot.Dispose(); $brush.Dispose(); $hl.Dispose()

  Write-Host ("{0,-18} {1}x{2}" -f $name, $W, $H)
}

Write-Host "`ncerceveli goruntuler: $out"
