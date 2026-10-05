$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$publishRoot = Join-Path $projectRoot 'out\publish-repo'
$repoUrl = 'https://github.com/NguyenTienDung857/DLT_APP.git'

if (Test-Path -LiteralPath $publishRoot) {
    Remove-Item -LiteralPath $publishRoot -Recurse -Force
}
git clone $repoUrl $publishRoot
if ($LASTEXITCODE -ne 0) { throw 'Could not clone the new repository.' }

$paths = git -C $projectRoot ls-files --cached --others --exclude-standard
if ($LASTEXITCODE -ne 0) { throw 'Could not list project source files.' }
foreach ($relativePath in $paths) {
    if ($relativePath -match '^(\.git/|\.claude/|app/|dist/|out/|node_modules/|251028_150419/)') { continue }
    if ($relativePath -match '(?i)(\.dlt|\.enc|\.exe|\.lnk)$' -or
        $relativePath -in @('system_space.txt', 'guid_build.txt')) { continue }
    $source = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
    $destination = Join-Path $publishRoot $relativePath
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

$settings = Join-Path $publishRoot '.claude/settings.local.json'
if (Test-Path -LiteralPath $settings) { Remove-Item -LiteralPath $settings -Force }
git -C $publishRoot add -A
git -C $publishRoot -c user.name='Codex' -c user.email='codex@users.noreply.github.com' commit -m 'replace API AI with ChatGPT log sharing'
if ($LASTEXITCODE -ne 0) { throw 'Could not commit the source snapshot.' }
git -C $publishRoot push -u origin HEAD:main
if ($LASTEXITCODE -ne 0) { throw 'Could not push the code snapshot.' }
git -C $publishRoot rev-parse HEAD
