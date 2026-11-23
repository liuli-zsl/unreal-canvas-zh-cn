[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$EngineRoot,
    [string]$SdkArchive
)
$ErrorActionPreference = 'Stop'
$engineDir = (Resolve-Path -LiteralPath $EngineRoot).Path
if ($SdkArchive) { $sdkFile = (Resolve-Path -LiteralPath $SdkArchive).Path }
function Invoke-NpmStep {
    & npm.cmd @args
    if ($LASTEXITCODE -ne 0) { throw "npm failed with exit code $LASTEXITCODE" }
}
Push-Location -LiteralPath (Join-Path $PSScriptRoot '../Frontend')
try {
    if ($sdkFile) {
        & node scripts/prepare-sdk.mjs $sdkFile
        if ($LASTEXITCODE -ne 0) { throw "SDK verification failed" }
    }
    else { Invoke-NpmStep run setup:sdk }
    Invoke-NpmStep ci --no-audit --no-fund
    Invoke-NpmStep test
    Invoke-NpmStep run build
    & python ../Packaging/package.py --engine $engineDir
    if ($LASTEXITCODE -ne 0) { throw "Plugin packaging failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}
