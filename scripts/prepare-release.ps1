$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$stagingRoot = Join-Path $projectRoot 'out\release-build'
$releaseRoot = Join-Path $projectRoot 'dist'
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
$installerName = "BLTN-Analysis-Log-Setup-$($package.version).exe"
$releaseNames = @($installerName, "$installerName.blockmap", 'latest.yml')

function Remove-GeneratedPath([string]$Target) {
    $resolvedTarget = [IO.Path]::GetFullPath($Target)
    if (-not $resolvedTarget.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing cleanup outside project: $resolvedTarget"
    }
    if (Test-Path -LiteralPath $resolvedTarget) {
        Remove-Item -LiteralPath $resolvedTarget -Recurse -Force
    }
}

& {
    foreach ($name in $releaseNames) {
        if (-not (Test-Path -LiteralPath (Join-Path $stagingRoot $name) -PathType Leaf)) {
            throw "Release file missing: $name"
        }
    }
    $metadata = Get-Content -LiteralPath (Join-Path $stagingRoot 'latest.yml') -Raw
    $installerPath = Join-Path $stagingRoot $installerName
    $sha = [Security.Cryptography.SHA512]::Create()
    try {
        $stream = [IO.File]::OpenRead($installerPath)
        try { $hash = [Convert]::ToBase64String($sha.ComputeHash($stream)) }
        finally { $stream.Dispose() }
    } finally { $sha.Dispose() }
    if (-not $metadata.Contains("version: $($package.version)") -or
        -not $metadata.Contains($installerName) -or -not $metadata.Contains($hash)) {
        throw 'Installer version/name/hash does not match latest.yml.'
    }
    $updateMetadata = Join-Path $stagingRoot 'win-unpacked\resources\app-update.yml'
    if (-not (Test-Path -LiteralPath $updateMetadata)) { throw 'Updater metadata missing from app.' }

    $running = Get-CimInstance Win32_Process -Filter "Name='BLTN-Analysis Log.exe'"
    foreach ($process in $running) {
        if ($process.ExecutablePath -and $process.ExecutablePath.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
            $nativeProcess = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
            if ($nativeProcess -and $nativeProcess.MainWindowHandle -ne 0) {
                $null = $nativeProcess.CloseMainWindow()
                if (-not $nativeProcess.WaitForExit(5000)) { throw 'Close the old build before cleanup.' }
            }
        }
    }
    Remove-GeneratedPath $releaseRoot
    $null = New-Item -ItemType Directory -Path $releaseRoot
    foreach ($name in $releaseNames) {
        Copy-Item -LiteralPath (Join-Path $stagingRoot $name) -Destination $releaseRoot
    }
    foreach ($name in $releaseNames) {
        $sourceHash = (Get-FileHash -LiteralPath (Join-Path $stagingRoot $name) -Algorithm SHA256).Hash
        $targetHash = (Get-FileHash -LiteralPath (Join-Path $releaseRoot $name) -Algorithm SHA256).Hash
        if ($sourceHash -ne $targetHash) { throw "Copy verification failed: $name" }
    }
    foreach ($folder in @('out\release-build', 'out\revised-build', 'out\ui-check')) {
        Remove-GeneratedPath (Join-Path $projectRoot $folder)
    }
    $outputRoot = Join-Path $projectRoot 'out'
    if ((Test-Path -LiteralPath $outputRoot) -and
        -not (Get-ChildItem -LiteralPath $outputRoot -Force | Select-Object -First 1)) {
        Remove-GeneratedPath $outputRoot
    }
    foreach ($item in Get-ChildItem -LiteralPath (Join-Path $projectRoot 'app') -File -ErrorAction SilentlyContinue) {
        if ($item.Name -match '^BLTN-Analysis-Log-Setup-\d+\.\d+\.\d+\.exe(?:\.blockmap)?$') {
            Remove-GeneratedPath $item.FullName
        }
    }
    $temporaryRoot = Join-Path $projectRoot '.codex-temp'
    if ((Test-Path -LiteralPath $temporaryRoot) -and
        -not (Get-ChildItem -LiteralPath $temporaryRoot -Force | Select-Object -First 1)) {
        Remove-GeneratedPath $temporaryRoot
    }
    Get-ChildItem -LiteralPath $releaseRoot -File | Select-Object Name,Length
}
