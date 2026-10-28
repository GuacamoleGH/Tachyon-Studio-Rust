<#
.SYNOPSIS
  Monitor de consumo de memoria RAM (WorkingSet y PrivateMemory) para Tachyon Studio y WebView2.
.DESCRIPTION
  Muestra cada segundo el consumo de RAM de los procesos tachyon-studio y msedgewebview2,
  calculando el pico máximo durante la exportación de vídeo.
#>

param (
    [int]$IntervalSec = 1,
    [int]$MaxDurationSec = 600
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " TACHYON STUDIO - MONITOR DE CONSUMO DE MEMORIA (RAM)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$peakTotalMB = 0
$peakTachyonMB = 0
$peakWebViewMB = 0
$startTime = Get-Date

while (((Get-Date) - $startTime).TotalSeconds -lt $MaxDurationSec) {
    $tachyonProcs = Get-Process -Name "tachyon-studio" -ErrorAction SilentlyContinue
    $webviewProcs = Get-Process -Name "msedgewebview2" -ErrorAction SilentlyContinue

    $tachyonMB = if ($tachyonProcs) { [Math]::Round(($tachyonProcs | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB, 2) } else { 0 }
    $webviewMB = if ($webviewProcs) { [Math]::Round(($webviewProcs | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB, 2) } else { 0 }
    $totalWorkingSetMB = [Math]::Round($tachyonMB + $webviewMB, 2)

    if ($tachyonMB -gt $peakTachyonMB) { $peakTachyonMB = $tachyonMB }
    if ($webviewMB -gt $peakWebViewMB) { $peakWebViewMB = $webviewMB }
    if ($totalWorkingSetMB -gt $peakTotalMB) { $peakTotalMB = $totalWorkingSetMB }

    if ($tachyonProcs -or $webviewProcs) {
        $timestamp = (Get-Date).ToString("HH:mm:ss")
        Write-Host "[$timestamp] tachyon-studio: $tachyonMB MB (pico $peakTachyonMB MB) | msedgewebview2: $webviewMB MB (pico $peakWebViewMB MB) | TOTAL: $totalWorkingSetMB MB (pico $peakTotalMB MB)" -ForegroundColor Yellow
    } else {
        Write-Host "[Esperando procesos 'tachyon-studio' o 'msedgewebview2'...]" -ForegroundColor Gray
    }

    Start-Sleep -Seconds $IntervalSec
}

Write-Host "----------------------------------------------------------" -ForegroundColor Green
Write-Host "MONITOREO FINALIZADO:" -ForegroundColor Green
Write-Host "  Pico tachyon-studio.exe : $peakTachyonMB MB" -ForegroundColor Green
Write-Host "  Pico msedgewebview2.exe : $peakWebViewMB MB" -ForegroundColor Green
Write-Host "  Pico Combinado Total    : $peakTotalMB MB" -ForegroundColor Green
Write-Host "----------------------------------------------------------" -ForegroundColor Green
