# Iki sayfa ekran goruntusunu yan yana koyup aralarina kaydirma oku cizer.
#
# Kaydirma hareketini durgun bir goruntuyle anlatmak zor; iki sayfayi yan yana
# gostermek jesti tek bakista anlatiyor.
#
#   powershell -ExecutionPolicy Bypass -File docs\make-swipe.ps1

Add-Type -AssemblyName System.Drawing

$docs = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $docs 'shots'
$out  = Join-Path $src 'framed'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$a = [System.Drawing.Image]::FromFile((Join-Path $src '12-page1.png'))
$b = [System.Drawing.Image]::FromFile((Join-Path $src '13-page2.png'))

$pad   = 24     # tablet cerceve kalinligi (dar tutuldu, iki gorsel yan yana)
$gap   = 96     # aradaki bosluk: ok buraya gelecek
$scale = 0.62   # yan yana sigsin diye kucult

$sw = [int]($a.Width  * $scale)
$sh = [int]($a.Height * $scale)
$tw = $sw + $pad * 2
$th = $sh + $pad * 2

$W = $tw * 2 + $gap
$H = $th

$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.InterpolationMode = 'HighQualityBicubic'
$g.Clear([System.Drawing.Color]::Transparent)

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

function Draw-Tablet($img, $x) {
  $body = New-RoundedPath $x 0 $tw $th 18
  $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point $x, 0),
    (New-Object System.Drawing.Point ($x + $tw), $th),
    [System.Drawing.Color]::FromArgb(255, 62, 69, 82),
    [System.Drawing.Color]::FromArgb(255, 32, 38, 47))
  $g.FillPath($br, $body)
  $hl = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(42, 255, 255, 255)), 1
  $g.DrawPath($hl, (New-RoundedPath ($x + 0.5) 0.5 ($tw - 1) ($th - 1) 18))
  $screen = New-RoundedPath ($x + $pad) $pad $sw $sh 4
  $g.SetClip($screen)
  $g.DrawImage($img, ($x + $pad), $pad, $sw, $sh)
  $g.ResetClip()
  $br.Dispose(); $hl.Dispose()
}

Draw-Tablet $a 0
Draw-Tablet $b ($tw + $gap)

# ok: soldaki tabletten sagdakine, jestin yonunu gosterir
$cx = $tw + [int]($gap / 2)
$cy = [int]($H / 2)
$accent = [System.Drawing.Color]::FromArgb(255, 94, 129, 172)
$pen = New-Object System.Drawing.Pen $accent, 3
$pen.EndCap = 'ArrowAnchor'
$g.DrawLine($pen, ($cx - 26), $cy, ($cx + 22), $cy)

# ok ucundaki parmak izi: jestin dokunusla yapildigini ima eder
$dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90, 94, 129, 172))
$g.FillEllipse($dot, ($cx - 40), ($cy - 14), 28, 28)

$g.Dispose()
$bmp.Save((Join-Path $out '12-swipe.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $a.Dispose(); $b.Dispose()

Write-Host "olusturuldu: $out\12-swipe.png  ($W x $H)"
