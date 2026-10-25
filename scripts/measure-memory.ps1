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
$startTime = Get-Date

while (((Get-Date) - $startTime).TotalSeconds -lt $MaxDurationSec) {
    $processes = Get-Process -Name "tachyon-studio", "msedgewebview2" -ErrorAction SilentlyContinue
    if ($processes) {
        $totalWorkingSetMB = [Math]::Round(($processes | Measure-Object -Property WorkingSet64 -Sum).Sum / 1MB, 2)
        $totalPrivateMB = [Math]::Round(($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum / 1MB, 2)

        if ($totalWorkingSetMB -gt $peakTotalMB) {
            $peakTotalMB = $totalWorkingSetMB
        }

        $timestamp = (Get-Date).ToString("HH:mm:ss")
        $procCount = $processes.Count

        Write-Host "[$timestamp] Procesos activos: $procCount | RAM Actual (WorkingSet): $totalWorkingSetMB MB | Privada: $totalPrivateMB MB | PICO: $peakTotalMB MB" -ForegroundColor Yellow
    } else {
        Write-Host "[Esperando procesos 'tachyon-studio' o 'msedgewebview2'...]" -ForegroundColor Gray
    }

    Start-Sleep -Seconds $IntervalSec
}

Write-Host "----------------------------------------------------------" -ForegroundColor Green
Write-Host "MONITOREO FINALIZADO. Pico maximo de RAM registrado: $peakTotalMB MB" -ForegroundColor Green
Write-Host "----------------------------------------------------------" -ForegroundColor Green
