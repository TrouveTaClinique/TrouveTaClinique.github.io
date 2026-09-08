# App icons: take the best hat-free pin on GitHub (512 PNG, navy #0F2240)
# and replace only that background with white. No enlarge, no crop.
# Source blob: git c7fd2d08 icon-512.png (before the white zip).
# The only larger PNG (1024) is assets/source/logo-officiel-theme-sombre.png
# and still has the festive hat — not used for the app icon.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root 'assets\source\logo-pin-navy-512.png'
$masterPath = Join-Path $root 'assets\source\logo-officiel-fond-blanc.png'

if (-not (Test-Path -LiteralPath $srcPath)) {
  throw "Source introuvable : $srcPath"
}

function Convert-NavyToWhite([string]$path) {
  $src = New-Object System.Drawing.Bitmap $path
  $w = $src.Width
  $h = $src.Height
  $dst = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $white = [System.Drawing.Color]::White
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $p = $src.GetPixel($x, $y)
      # Navy square + hole + S-gap (and anti-aliased navy fringe)
      if ($p.R -lt 28 -and $p.G -lt 55 -and $p.B -lt 85) {
        $dst.SetPixel($x, $y, $white)
      } else {
        $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
      }
    }
  }
  $src.Dispose()
  return $dst
}

function Save-Png($bmp, [string]$outPath) {
  if (Test-Path -LiteralPath $outPath) { Remove-Item -LiteralPath $outPath -Force }
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output ("Ecrit {0} ({1}x{2})" -f (Split-Path $outPath -Leaf), $bmp.Width, $bmp.Height)
}

function Save-Scaled($srcBmp, [string]$outPath, [int]$size) {
  $canvas = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($srcBmp, 0, 0, $size, $size)
  $g.Dispose()
  Save-Png $canvas $outPath
  $canvas.Dispose()
}

$white512 = Convert-NavyToWhite $srcPath
Save-Png $white512 $masterPath

$same = @(
  'icon-512.png', 'icon-est-512.png',
  'icon-512-maskable.png', 'icon-est-512-maskable.png'
)
foreach ($n in $same) { Save-Png $white512 (Join-Path $root $n) }

Save-Scaled $white512 (Join-Path $root 'icon-192.png') 192
Save-Scaled $white512 (Join-Path $root 'icon-est-192.png') 192
Save-Scaled $white512 (Join-Path $root 'icon-192-maskable.png') 192
Save-Scaled $white512 (Join-Path $root 'icon-est-192-maskable.png') 192
Save-Scaled $white512 (Join-Path $root 'apple-touch-icon-180.png') 180
Save-Scaled $white512 (Join-Path $root 'apple-touch-icon-est.png') 180

$white512.Dispose()
Write-Output 'Termine.'
