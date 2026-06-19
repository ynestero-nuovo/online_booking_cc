# Generates src/integration/catalog.ts from the clinic price list (xlsx).
# Usage: powershell -File scripts/generate-catalog.ps1 "<path to .xlsx>"
# Rules: price = column B; durationMin = 30 for services containing "Lumecca", else 60.
# NOTE: keep this script ASCII-only (PowerShell 5.1 -File reads as ANSI). Service
# names come from the xlsx at runtime, so Ukrainian data is preserved correctly.
param([Parameter(Mandatory=$true)][string]$XlsxPath)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($XlsxPath)
function Read-Entry($n){ $e=$z.GetEntry($n); $r=New-Object System.IO.StreamReader($e.Open(),[System.Text.Encoding]::UTF8); $t=$r.ReadToEnd(); $r.Close(); $t }
$ssXml = Read-Entry 'xl/sharedStrings.xml'
$sheet = Read-Entry 'xl/worksheets/sheet1.xml'
$z.Dispose()

$strings = New-Object System.Collections.ArrayList
foreach($m in [regex]::Matches($ssXml,'(?s)<si>(.*?)</si>')){
  $ts=[regex]::Matches($m.Groups[1].Value,'(?s)<t[^>]*>(.*?)</t>')
  [void]$strings.Add( (($ts|ForEach-Object{$_.Groups[1].Value}) -join '') )
}

function Decode($s){
  $s.Replace('&lt;','<').Replace('&gt;','>').Replace('&quot;','"').Replace('&#39;',"'").Replace('&apos;',"'").Replace('&amp;','&').Trim()
}
function TsEsc($s){ $s.Replace('\','\\').Replace('"','\"') }

$rowData = @()
foreach($row in [regex]::Matches($sheet,'(?s)<row[^>]*r="(\d+)"[^>]*>(.*?)</row>')){
  $cells = @{}
  foreach($c in [regex]::Matches($row.Groups[2].Value,'(?s)<c r="([A-Z]+)\d+"([^>]*)>(.*?)</c>')){
    $col=$c.Groups[1].Value; $attr=$c.Groups[2].Value
    $vm=[regex]::Match($c.Groups[3].Value,'(?s)<v>(.*?)</v>')
    if(-not $vm.Success){ continue }
    $v=$vm.Groups[1].Value
    if($attr -match 't="s"'){ $v=$strings[[int]$v] }
    $cells[$col]=$v
  }
  $rowData += ,([pscustomobject]@{ A=$cells['A']; B=$cells['B'] })
}

# Header category = row with text in A and no numeric price in B.
$categories = New-Object System.Collections.ArrayList
$services = New-Object System.Collections.ArrayList
$curCatId = $null
$catIdx = 0
$svcIdx = 0
foreach($r in $rowData){
  $a = if($r.A){ Decode([string]$r.A) } else { '' }
  if(-not $a){ continue }
  $b = if($r.B){ Decode([string]$r.B) } else { '' }
  $price = 0.0
  $isNum = [double]::TryParse($b, [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$price)
  if($isNum){
    # Service with a price.
    if($null -eq $curCatId){ $curCatId = "cat-$catIdx"; [void]$categories.Add([pscustomobject]@{ id=$curCatId; name='Other'; order=$catIdx }); $catIdx++ }
    $dur = if($a -match 'Lumecca'){ 30 } else { 60 }
    [void]$services.Add([pscustomobject]@{ id="svc-$svcIdx"; name=$a; categoryId=$curCatId; durationMin=$dur; price=[int]$price })
    $svcIdx++
  } elseif($b.Length -gt 2){
    # Empty handled below; here B is a longer text label (e.g. column header) -> category.
    $curCatId = "cat-$catIdx"
    [void]$categories.Add([pscustomobject]@{ id=$curCatId; name=$a; order=$catIdx })
    $catIdx++
  } elseif($b -eq ''){
    # No B value at all -> category header.
    $curCatId = "cat-$catIdx"
    [void]$categories.Add([pscustomobject]@{ id=$curCatId; name=$a; order=$catIdx })
    $catIdx++
  }
  # else: B is a short non-numeric token (dash = price TBD) -> skip this row.
}

# Drop categories with no services, renumber order.
$usedCats = $services | ForEach-Object { $_.categoryId } | Sort-Object -Unique
$categories = $categories | Where-Object { $usedCats -contains $_.id }
$ord=0; foreach($c in $categories){ $c.order=$ord; $ord++ }

$nl = "`n"
$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('// AUTO-GENERATED from the clinic price list by scripts/generate-catalog.ps1.' + $nl)
[void]$sb.Append('// Do not edit by hand. Price = "other doctors" column; durationMin is a' + $nl)
[void]$sb.Append('// placeholder (60 min, Lumecca 30). specialistIds are NOT set here -- each' + $nl)
[void]$sb.Append('// provider attaches them (mock: own ids, Cliniccards: real doctor_id).' + $nl)
[void]$sb.Append($nl)
[void]$sb.Append('import type { Category } from "@/domain/types";' + $nl)
[void]$sb.Append($nl)
[void]$sb.Append('/** Catalog service without specialistIds (a provider attaches them). */' + $nl)
[void]$sb.Append('export interface CatalogService {' + $nl)
[void]$sb.Append('  id: string;' + $nl)
[void]$sb.Append('  name: string;' + $nl)
[void]$sb.Append('  categoryId: string;' + $nl)
[void]$sb.Append('  durationMin: number;' + $nl)
[void]$sb.Append('  price: number;' + $nl)
[void]$sb.Append('}' + $nl)
[void]$sb.Append($nl)
[void]$sb.Append('export const CATALOG_CATEGORIES: Category[] = [' + $nl)
foreach($c in $categories){
  [void]$sb.Append("  { id: `"$($c.id)`", name: `"$(TsEsc $c.name)`", order: $($c.order) }," + $nl)
}
[void]$sb.Append('];' + $nl)
[void]$sb.Append($nl)
[void]$sb.Append('export const CATALOG_SERVICES: CatalogService[] = [' + $nl)
foreach($s in $services){
  [void]$sb.Append("  { id: `"$($s.id)`", name: `"$(TsEsc $s.name)`", categoryId: `"$($s.categoryId)`", durationMin: $($s.durationMin), price: $($s.price) }," + $nl)
}
[void]$sb.Append('];' + $nl)
[void]$sb.Append($nl)
[void]$sb.Append('/** Service duration (min) by id. */' + $nl)
[void]$sb.Append('export function catalogDurationMin(serviceId: string): number | undefined {' + $nl)
[void]$sb.Append('  return CATALOG_SERVICES.find((s) => s.id === serviceId)?.durationMin;' + $nl)
[void]$sb.Append('}' + $nl)

$outPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'src/integration/catalog.ts'
[System.IO.File]::WriteAllText($outPath, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Wrote $outPath : $($categories.Count) categories, $($services.Count) services"
