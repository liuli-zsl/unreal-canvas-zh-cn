[CmdletBinding()]
param(
    [string]$ServerUrl,
    [string]$InstallRoot
)

$ErrorActionPreference = 'Stop'
$pluginId = 'unreal-canvas-zh-cn'
$sourceRoot = $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.id -ne $pluginId -or $manifest.apiVersion -ne 1) {
    throw 'Unexpected plugin manifest.'
}
if ($ServerUrl) {
    $serverUri = [Uri]$ServerUrl
    if (-not $serverUri.IsLoopback -or $serverUri.Scheme -notin @('http', 'https')) {
        throw 'ServerUrl must refer to a local Canvas server.'
    }
    $installed = Invoke-RestMethod -Uri ($ServerUrl.TrimEnd('/') + '/api/plugins/installed')
    $InstallRoot = $installed.installRoot
}
if (-not $InstallRoot) {
    $InstallRoot = Join-Path $env:APPDATA 'com.epicgames.unrealcanvas\plugins'
}
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$target = [IO.Path]::GetFullPath((Join-Path $InstallRoot $pluginId))
if ([IO.Path]::GetDirectoryName($target) -ne $InstallRoot.TrimEnd('\', '/')) {
    throw 'Target must be the plugin ID directory directly inside InstallRoot.'
}
if ($target.TrimEnd('\') -eq $sourceRoot.TrimEnd('\')) {
    throw 'The source folder is already the installation folder.'
}
$releaseFiles = @('manifest.json', 'dist/index.js', 'README.md', 'install.ps1', 'VERIFICATION.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY.md')
foreach ($name in $releaseFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $name) -PathType Leaf)) {
        throw "Missing release file: $name"
    }
}
$installParent = Split-Path $InstallRoot -Parent
New-Item -ItemType Directory -Path $installParent -Force | Out-Null
$installLock = [IO.File]::Open((Join-Path $installParent 'canvas-zh-install.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
$stage = Join-Path $installParent ('canvas-zh-install-' + [Guid]::NewGuid().ToString('N'))
$backup = $null
try {
    New-Item -ItemType Directory -Path (Join-Path $stage 'dist') -Force | Out-Null
    foreach ($name in $releaseFiles) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination (Join-Path $stage $name)
    }
    $expected = (Get-FileHash -LiteralPath (Join-Path $sourceRoot 'dist/index.js') -Algorithm SHA256).Hash
    if ((Get-FileHash -LiteralPath (Join-Path $stage 'dist/index.js') -Algorithm SHA256).Hash -ne $expected) {
        throw 'Staged file hash does not match the release.'
    }
    New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
    if (Test-Path -LiteralPath $target) {
        $oldManifestPath = Join-Path $target 'manifest.json'
        if (-not (Test-Path -LiteralPath $oldManifestPath -PathType Leaf)) {
            throw 'Existing target lacks a manifest. Review that folder before installing.'
        }
        $oldManifest = Get-Content -LiteralPath $oldManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($oldManifest.id -ne $pluginId) {
            throw 'Existing target belongs to another plugin.'
        }
        $backupRoot = Join-Path (Split-Path $InstallRoot -Parent) 'canvas-zh-backups'
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $backup = Join-Path $backupRoot ($pluginId + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
        Move-Item -LiteralPath $target -Destination $backup
    }
    try {
        Move-Item -LiteralPath $stage -Destination $target
    } catch {
        if ($backup -and -not (Test-Path -LiteralPath $target)) {
            Move-Item -LiteralPath $backup -Destination $target
        }
        throw
    }
    $actual = (Get-FileHash -LiteralPath (Join-Path $target 'dist/index.js') -Algorithm SHA256).Hash
    if ($expected -ne $actual) { throw 'Installed file hash does not match the release.' }
    Write-Output "Installed $pluginId $($manifest.version) in $target"
    if ($backup) { Write-Output "Previous version backed up to $backup" }
    Write-Output 'Open Canvas Settings > Extensions > Installed > Plugins. Allow this plugin if requested, then enable or Reload it.'
    Write-Output "SHA256 $actual"
} finally {
    $installLock.Dispose()
    # A sibling stage keeps directory moves on the destination filesystem.
    $resolvedStage = [IO.Path]::GetFullPath($stage)
    if ([IO.Path]::GetDirectoryName($resolvedStage) -eq [IO.Path]::GetFullPath($installParent) -and
        [IO.Path]::GetFileName($resolvedStage).StartsWith('canvas-zh-install-') -and
        (Test-Path -LiteralPath $resolvedStage)) {
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
