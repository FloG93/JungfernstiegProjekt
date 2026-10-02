<#
.SYNOPSIS
    Baut PianoScribe für Windows: Oberfläche, Assets, Programmordner (PyInstaller) und Installer.

.DESCRIPTION
    Voraussetzungen: uv, Node.js 20+ (npm) und für den Installer Inno Setup 6.3 oder neuer.
    Das Skript benutzt eine eigene Build-Umgebung (packaging\.venv-build) mit den
    Laufzeit-Paketen aus uv.lock plus PyInstaller; die Entwicklungsumgebung bleibt unberührt.

    Ergebnis:
      packaging\dist\PianoScribe\PianoScribe.exe        Programmordner (auch ohne Installation lauffähig)
      packaging\Output\PianoScribe-Setup-<Version>.exe  Installer (+ .bin-Dateien daneben)

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File packaging\build.ps1

.EXAMPLE
    packaging\build.ps1 -SkipInstaller -ModelTest
#>
[CmdletBinding()]
param(
    # vorhandenes frontend\dist verwenden statt neu zu bauen
    [switch]$SkipFrontend,
    # nur den Programmordner bauen, keinen Installer
    [switch]$SkipInstaller,
    # Rauchtest des fertigen Programms überspringen
    [switch]$SkipSelfTest,
    # Rauchtest mit Modellen (lädt sie bei Bedarf herunter, ca. 350 MB)
    [switch]$ModelTest,
    # Pfad zu ISCC.exe, falls Inno Setup nicht automatisch gefunden wird
    [string]$Iscc = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
# Die Python-Programme geben UTF-8 aus (✔, Umlaute); so zeigt PowerShell das richtig an.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Packaging = $PSScriptRoot
$Root = Split-Path -Parent $Packaging
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Dist = Join-Path $Packaging "dist"
$Work = Join-Path $Packaging "build"
$AppDir = Join-Path $Dist "PianoScribe"
$Spec = Join-Path $Packaging "pianoscribe.spec"
$FetchAssets = Join-Path (Join-Path $Root "scripts") "fetch_assets.py"
# Das Skript ist für Windows gedacht, läuft zum Testen aber auch mit PowerShell 7 unter Linux.
$ExeSuffix = if ($env:OS -eq "Windows_NT") { ".exe" } else { "" }

function Write-Step([string]$Text) {
    Write-Host ""
    Write-Host "==> $Text" -ForegroundColor Cyan
}

function Invoke-Native {
    # Startet ein externes Programm und bricht bei einem Fehlercode ab. Ausgaben auf stderr
    # (PyInstaller, npm) gelten dabei nicht als Fehler.
    param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @())
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Exe @Arguments
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($LASTEXITCODE -ne 0) {
        throw "'$Exe $($Arguments -join ' ')' ist fehlgeschlagen (Exit-Code $LASTEXITCODE)."
    }
}

function Find-Iscc {
    if ($Iscc) { return $Iscc }
    $command = Get-Command "iscc.exe" -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
        (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }
    throw ("Inno Setup (ISCC.exe) wurde nicht gefunden. Installieren mit " +
           "'winget install JRSoftware.InnoSetup', mit -Iscc angeben oder -SkipInstaller verwenden.")
}

foreach ($tool in @("uv", "npm")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "'$tool' wurde nicht gefunden - siehe README, Abschnitt 'Windows: Build und Installer'."
    }
}

$init = Get-Content (Join-Path (Join-Path $Backend "pianoscribe") "__init__.py") -Raw
if ($init -notmatch '__version__\s*=\s*"([^"]+)"') { throw "Version in pianoscribe\__init__.py nicht gefunden." }
$Version = $Matches[1]
$timer = [Diagnostics.Stopwatch]::StartNew()
Write-Host "PianoScribe $Version - Windows-Build" -ForegroundColor Green

# 1. Oberfläche
if (-not $SkipFrontend) {
    Write-Step "Oberfläche bauen (npm ci, npm run build)"
    Push-Location $Frontend
    try {
        Invoke-Native "npm" @("ci", "--no-audit", "--no-fund")
        Invoke-Native "npm" @("run", "build")
    } finally {
        Pop-Location
    }
}

# 2. Build-Umgebung, Assets und PyInstaller
$env:UV_PROJECT_ENVIRONMENT = Join-Path $Packaging ".venv-build"
Push-Location $Backend
try {
    Write-Step "Build-Umgebung (Laufzeit-Pakete aus uv.lock + PyInstaller)"
    Invoke-Native "uv" @("sync", "--locked", "--no-dev", "--group", "build")

    Write-Step "Assets laden (Klavier-Samples, ffmpeg)"
    Invoke-Native "uv" @("run", "--no-sync", "python", $FetchAssets)

    Write-Step "PyInstaller (dauert einige Minuten)"
    Invoke-Native "uv" @("run", "--no-sync", "pyinstaller", $Spec, "--noconfirm", "--clean",
                         "--distpath", $Dist, "--workpath", $Work)
} finally {
    Pop-Location
    Remove-Item Env:UV_PROJECT_ENVIRONMENT -ErrorAction SilentlyContinue
}

# 3. Rauchtest des fertigen Programms (pianoscribe-cli.exe selftest)
$Cli = Join-Path $AppDir "pianoscribe-cli$ExeSuffix"
if (-not $SkipSelfTest) {
    Write-Step "Rauchtest"
    $selftest = @("selftest")
    if ($ModelTest) {
        Invoke-Native $Cli @("models", "download")
        $selftest += "--models"
    }
    Invoke-Native $Cli $selftest
}

# 4. Installer
if (-not $SkipInstaller) {
    Write-Step "Installer (Inno Setup)"
    Invoke-Native (Find-Iscc) @("/Q", "/DAppVersion=$Version", (Join-Path $Packaging "installer.iss"))
}

$size = (Get-ChildItem $AppDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1GB
Write-Host ""
Write-Host ("Fertig nach {0:hh\:mm\:ss}. Programmordner: {1} ({2:N1} GB)" -f $timer.Elapsed, $AppDir, $size) -ForegroundColor Green
if (-not $SkipInstaller) {
    $setup = Join-Path $Packaging "Output\PianoScribe-Setup-$Version.exe"
    Write-Host "Installer: $setup (die .bin-Dateien daneben gehören dazu)" -ForegroundColor Green
}
