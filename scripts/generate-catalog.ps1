# Generates src/integration/catalog.ts from pricemap.xlsx (sheet "прайс для онлайн запису").
# Columns: A=service/category, B=price(UAH), C..G = duration(min) per specialist:
#   C=kovbasa D=samoukova E=kashytska F=movchan G=kalashnik.
# Empty duration cell => that specialist does NOT provide the service.
# A row with a price but zero durations (nobody provides) is skipped.
# Usage: powershell -File scripts/generate-catalog.ps1 [path-to-xlsx]
# NOTE: keep this script ASCII-only (PowerShell 5.1 -File reads as ANSI); names come from xlsx.
param([string]$XlsxPath = "src/lib/price_spec_map/pricemap.xlsx")

$root = Split-Path $PSScriptRoot -Parent
$full = if ([System.IO.Path]::IsPathRooted($XlsxPath)) { $XlsxPath } else { Join-Path $root $XlsxPath }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($full)
function Get-ZipText($n) { $e = $z.GetEntry($n); $r = New-Object System.IO.StreamReader($e.Open(), [System.Text.Encoding]::UTF8); $t = $r.ReadToEnd(); $r.Close(); $t }
$ss = Get-ZipText 'xl/sharedStrings.xml'
# Pick the matrix worksheet robustly (not by hard-coded number): the online-booking
# sheet has 5 specialist duration columns, so its header has a TEXT cell in column G.
$sheetFiles = $z.Entries | Where-Object { $_.FullName -match 'xl/worksheets/sheet\d+\.xml$' } | ForEach-Object { $_.FullName }
$sheet = $null
foreach ($sf in $sheetFiles) { $txt = Get-ZipText $sf; if ($txt -match '<c r="G\d+"[^>]*t="s"') { $sheet = $txt; break } }
if (-not $sheet -and $sheetFiles.Count -gt 0) { $sheet = Get-ZipText $sheetFiles[0] }
$z.Dispose()
if (-not $sheet) { throw "No matrix worksheet found in $full" }

$strings = New-Object System.Collections.ArrayList
foreach ($m in [regex]::Matches($ss, '(?s)<si>(.*?)</si>')) {
  $ts = [regex]::Matches($m.Groups[1].Value, '(?s)<t[^>]*>(.*?)</t>')
  [void]$strings.Add((($ts | ForEach-Object { $_.Groups[1].Value }) -join ''))
}
function Dec($s) { $s.Replace('&lt;', '<').Replace('&gt;', '>').Replace('&quot;', '"').Replace('&#39;', "'").Replace('&apos;', "'").Replace('&amp;', '&').Trim() }
function TsEsc($s) { $s.Replace('\', '\\').Replace('"', '\"') }
function ToNum([string]$v) { $n = 0.0; if ([double]::TryParse($v, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$n)) { $n } else { $null } }

$COLKEY = @{ C = 'kovbasa'; D = 'samoukova'; E = 'kashytska'; F = 'movchan'; G = 'kalashnik' }

$categories = New-Object System.Collections.ArrayList
$services = New-Object System.Collections.ArrayList
$curCat = $null; $catIdx = 0; $svcIdx = 0; $skipped = 0

foreach ($row in [regex]::Matches($sheet, '(?s)<row[^>]*r="(\d+)"[^>]*>(.*?)</row>')) {
  $cells = @{}
  # Match BOTH self-closing (<c r="D1"/>) and content (<c r="A1">...</c>) cells, so an
  # empty cell can't swallow the next column's value.
  foreach ($c in [regex]::Matches($row.Groups[2].Value, '(?s)<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)')) {
    $col = $c.Groups[1].Value; $attr = $c.Groups[2].Value
    $vm = [regex]::Match($c.Groups[3].Value, '(?s)<v>(.*?)</v>'); if (-not $vm.Success) { continue }
    $v = $vm.Groups[1].Value; if ($attr -match 't="s"') { $v = Dec([string]$strings[[int]$v]) }
    $cells[$col] = $v
  }
  if (-not $cells.ContainsKey('A')) { continue }
  $name = ([string]$cells['A']).Trim(); if (-not $name) { continue }

  $providers = New-Object System.Collections.ArrayList
  $dur = $null
  foreach ($k in 'C', 'D', 'E', 'F', 'G') {
    if ($cells.ContainsKey($k)) { $d = ToNum([string]$cells[$k]); if ($null -ne $d -and $d -gt 0) { [void]$providers.Add($COLKEY[$k]); if ($null -eq $dur) { $dur = $d } } }
  }
  $price = if ($cells.ContainsKey('B')) { ToNum([string]$cells['B']) } else { $null }

  if ($providers.Count -eq 0) {
    if ($null -eq $price) {
      # No price, no providers -> category header.
      $curCat = "cat-$catIdx"
      [void]$categories.Add([pscustomobject]@{ id = $curCat; name = $name; order = $catIdx }); $catIdx++
    } else { $skipped++ }  # priced but nobody provides -> not bookable
    continue
  }

  if ($null -eq $price) { $skipped++; continue }  # has providers but no price -> not bookable
  if ($null -eq $curCat) { $curCat = "cat-$catIdx"; [void]$categories.Add([pscustomobject]@{ id = $curCat; name = 'Other'; order = $catIdx }); $catIdx++ }
  [void]$services.Add([pscustomobject]@{
      id = "svc-$svcIdx"; name = $name; categoryId = $curCat
      durationMin = [int]$dur; price = [int]([math]::Round($price)); providers = @($providers)
    }); $svcIdx++
}

# Drop empty categories, renumber order.
$used = $services | ForEach-Object { $_.categoryId } | Sort-Object -Unique
$categories = $categories | Where-Object { $used -contains $_.id }
$ord = 0; foreach ($c in $categories) { $c.order = $ord; $ord++ }

$nl = "`n"; $sb = New-Object System.Text.StringBuilder
[void]$sb.Append('// AUTO-GENERATED from pricemap.xlsx (sheet 2: online-booking price/duration map)' + $nl)
[void]$sb.Append('// by scripts/generate-catalog.ps1. Do not edit by hand.' + $nl)
[void]$sb.Append('// price = UAH; durationMin = minutes; providers = doctors that offer the service' + $nl)
[void]$sb.Append('// (empty duration cell in the sheet => specialist does not provide it).' + $nl + $nl)
[void]$sb.Append('import type { Category } from "@/domain/types";' + $nl + $nl)
[void]$sb.Append('export type DoctorKey = "kovbasa" | "samoukova" | "kashytska" | "movchan" | "kalashnik";' + $nl + $nl)
[void]$sb.Append('/** Catalog service; a provider maps providers -> its own specialist ids. */' + $nl)
[void]$sb.Append('export interface CatalogService {' + $nl + '  id: string;' + $nl + '  name: string;' + $nl + '  categoryId: string;' + $nl + '  durationMin: number;' + $nl + '  price: number;' + $nl + '  providers: DoctorKey[];' + $nl + '}' + $nl + $nl)
[void]$sb.Append('export const CATALOG_CATEGORIES: Category[] = [' + $nl)
foreach ($c in $categories) { [void]$sb.Append("  { id: `"$($c.id)`", name: `"$(TsEsc $c.name)`", order: $($c.order) },$nl") }
[void]$sb.Append('];' + $nl + $nl)
[void]$sb.Append('export const CATALOG_SERVICES: CatalogService[] = [' + $nl)
foreach ($s in $services) {
  $prov = ($s.providers | ForEach-Object { "`"$_`"" }) -join ', '
  [void]$sb.Append("  { id: `"$($s.id)`", name: `"$(TsEsc $s.name)`", categoryId: `"$($s.categoryId)`", durationMin: $($s.durationMin), price: $($s.price), providers: [$prov] },$nl")
}
[void]$sb.Append('];' + $nl + $nl)
[void]$sb.Append('/** Service duration (min) by id. */' + $nl)
[void]$sb.Append('export function catalogDurationMin(serviceId: string): number | undefined {' + $nl + '  return CATALOG_SERVICES.find((s) => s.id === serviceId)?.durationMin;' + $nl + '}' + $nl)

$out = Join-Path $root 'src/integration/catalog.ts'
[System.IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Wrote $out : $($categories.Count) categories, $($services.Count) services, skipped(no-provider) $skipped"
