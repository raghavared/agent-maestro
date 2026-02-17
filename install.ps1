# ============================================================
#  Agent Maestro - Windows PowerShell Installer
#  Usage: irm https://raw.githubusercontent.com/subhangR/agent-maestro/main/install.ps1 | iex
# ============================================================

$ErrorActionPreference = 'Stop'

# ── Defaults ───────────────────────────────────────────────

$InstallDir = if ($env:MAESTRO_INSTALL) { $env:MAESTRO_INSTALL } else { Join-Path $env:USERPROFILE ".maestro" }
$Version    = if ($env:MAESTRO_VERSION) { $env:MAESTRO_VERSION } else { "latest" }
$Target     = "win-x64"
$IsCI       = [bool]$env:CI

$Repo           = "subhangR/agent-maestro"
$GitHubAPI      = "https://api.github.com/repos/$Repo/releases/latest"
$GitHubDownload = "https://github.com/$Repo/releases/download"

# ── Color helpers ──────────────────────────────────────────

function Write-Info    { param([string]$Msg) Write-Host "info  " -ForegroundColor Blue -NoNewline; Write-Host $Msg }
function Write-Success { param([string]$Msg) Write-Host "done  " -ForegroundColor Green -NoNewline; Write-Host $Msg }
function Write-Warn    { param([string]$Msg) Write-Host "warn  " -ForegroundColor Yellow -NoNewline; Write-Host $Msg }
function Write-Err     { param([string]$Msg) Write-Host "error " -ForegroundColor Red -NoNewline; Write-Host $Msg }

function Tildify {
    param([string]$Path)
    if ($Path.StartsWith($env:USERPROFILE)) {
        return "~" + $Path.Substring($env:USERPROFILE.Length)
    }
    return $Path
}

# ── Resolve version ───────────────────────────────────────

function Resolve-LatestVersion {
    if ($Version -eq "latest") {
        Write-Info "Resolving latest version from GitHub..."
        try {
            $headers = @{ "User-Agent" = "MaestroInstaller/1.0" }
            $release = Invoke-RestMethod -Uri $GitHubAPI -Headers $headers -UseBasicParsing
            $script:Version = $release.tag_name
        }
        catch {
            Write-Err "Failed to resolve latest version from GitHub Releases API."
            Write-Err "URL: $GitHubAPI"
            throw
        }
        if (-not $script:Version) {
            Write-Err "Failed to resolve latest version from GitHub Releases API."
            throw "Version tag not found in API response."
        }
    }
    Write-Info "Installing Agent Maestro version: $script:Version"
}

# ── SHA256 verification ───────────────────────────────────

function Verify-Checksum {
    param(
        [string]$ArchivePath,
        [string]$ArchiveName,
        [string]$TempDir
    )

    $checksumsUrl  = "$GitHubDownload/$script:Version/checksums.txt"
    $checksumsFile = Join-Path $TempDir "checksums.txt"

    Write-Info "Downloading checksums..."
    try {
        Invoke-WebRequest -Uri $checksumsUrl -OutFile $checksumsFile -UseBasicParsing
    }
    catch {
        Write-Warn "Could not download checksums.txt; skipping verification."
        return
    }

    $lines = Get-Content $checksumsFile
    $match = $lines | Where-Object { $_ -match $ArchiveName } | Select-Object -First 1

    if (-not $match) {
        Write-Warn "No checksum found for $ArchiveName in checksums.txt; skipping verification."
        return
    }

    $expected = ($match -split '\s+')[0]
    $actual   = (Get-FileHash -Path $ArchivePath -Algorithm SHA256).Hash.ToLower()

    if ($expected -ne $actual) {
        Write-Err "SHA256 checksum mismatch for $ArchiveName"
        Write-Err "  Expected: $expected"
        Write-Err "  Actual:   $actual"
        throw "Checksum verification failed."
    }
    Write-Success "SHA256 checksum verified"
}

# ── Main installation ─────────────────────────────────────

$TempDir = $null

try {
    # Create temp directory
    $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("maestro-install-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    # Resolve version
    Resolve-LatestVersion

    # ── Download & install CLI + server ────────────────────

    $archiveName = "maestro-${Target}.zip"
    $archiveUrl  = "$GitHubDownload/$Version/$archiveName"
    $archivePath = Join-Path $TempDir $archiveName

    Write-Info "Downloading $archiveName..."
    Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing
    Write-Success "Downloaded $archiveName"

    Verify-Checksum -ArchivePath $archivePath -ArchiveName $archiveName -TempDir $TempDir

    $binDir = Join-Path $InstallDir "bin"
    Write-Info "Extracting to $(Tildify $InstallDir)..."
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    Expand-Archive -Path $archivePath -DestinationPath $binDir -Force
    Write-Success "Installed CLI and server to $(Tildify $binDir)"

    # ── Create directories ─────────────────────────────────

    $dirsToCreate = @("apps", "data", "sessions")
    foreach ($d in $dirsToCreate) {
        $dirPath = Join-Path $InstallDir $d
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }

    # ── Download desktop app ───────────────────────────────

    if ($IsCI) {
        Write-Info "CI detected; skipping desktop app installation."
    }
    else {
        $desktopName = "maestro-desktop-${Target}.exe"
        $desktopUrl  = "$GitHubDownload/$Version/$desktopName"
        $desktopPath = Join-Path $InstallDir "apps" $desktopName

        Write-Info "Downloading desktop app ($desktopName)..."
        try {
            Invoke-WebRequest -Uri $desktopUrl -OutFile $desktopPath -UseBasicParsing
            Write-Success "Installed desktop app to $(Tildify $desktopPath)"
        }
        catch {
            Write-Warn "Could not download desktop app; skipping."
        }
    }

    # ── Create config ──────────────────────────────────────

    $configFile = Join-Path $InstallDir "config"
    if (-not (Test-Path $configFile)) {
        $configContent = @"
# Agent Maestro configuration
# This file is created on first install and preserved on upgrades.
MAESTRO_API_URL=http://localhost:2357
"@
        Set-Content -Path $configFile -Value $configContent -Encoding UTF8
        Write-Success "Created config at $(Tildify $configFile)"
    }
    else {
        Write-Info "Config already exists at $(Tildify $configFile); preserving."
    }

    # ── Update PATH ────────────────────────────────────────

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -and ($userPath -split ';' | ForEach-Object { $_.TrimEnd('\') }) -contains $binDir.TrimEnd('\')) {
        Write-Info "$(Tildify $binDir) is already in PATH"
    }
    else {
        if ($userPath) {
            $newPath = "$binDir;$userPath"
        }
        else {
            $newPath = $binDir
        }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Success "Added $(Tildify $binDir) to user PATH"
    }

    # ── Print success ──────────────────────────────────────

    Write-Host ""
    Write-Host "Agent Maestro has been installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Location    $(Tildify $InstallDir)"
    Write-Host "  CLI         $(Tildify $binDir)\maestro.exe"
    Write-Host "  Server      $(Tildify $binDir)\maestro-server.exe"

    if (-not $IsCI) {
        Write-Host "  Desktop     $(Tildify (Join-Path $InstallDir 'apps' "maestro-desktop-${Target}.exe"))"
    }

    Write-Host "  Config      $(Tildify $configFile)"
    Write-Host "  Version     $Version"
    Write-Host ""

    if ($IsCI) {
        Write-Info "CI mode: run maestro.exe from $(Tildify $binDir)"
    }
    else {
        Write-Info "To get started, open a new terminal and run:"
        Write-Host ""
        Write-Host "  maestro --help"
        Write-Host ""
    }
}
finally {
    # ── Clean up temp directory ────────────────────────────
    if ($TempDir -and (Test-Path $TempDir)) {
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    }
}
