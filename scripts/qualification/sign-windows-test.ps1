$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$outputRoot = if ($args.Count -ge 1) { [IO.Path]::GetFullPath($args[0]) } else { [IO.Path]::GetFullPath('out') }
$reportPath = if ($args.Count -ge 2) { [IO.Path]::GetFullPath($args[1]) } else { [IO.Path]::GetFullPath('artifacts/phase-14/signing/windows-test-signature.json') }
$testedCommit = (& git rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $testedCommit -notmatch '^[a-f0-9]{40}$') {
  throw 'Could not resolve one complete checked-out Git commit.'
}
if ($env:GITHUB_SHA -and $env:GITHUB_SHA -ne $testedCommit) {
  throw "GITHUB_SHA does not match the checked-out commit: expected $testedCommit."
}
$executables = @(Get-ChildItem -Path $outputRoot -Recurse -File -Filter 'si-world.exe')
if ($executables.Count -ne 1) {
  throw "Expected one Windows main executable, found $($executables.Count)."
}

$certificate = $null
try {
  $certificate = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject 'CN=SI World Phase 14 Local Test' `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -HashAlgorithm SHA256 `
    -KeyExportPolicy NonExportable `
    -NotAfter (Get-Date).AddDays(2)
  $signTool = (Get-Command signtool.exe -ErrorAction Stop).Source
  & $signTool sign /sha1 $certificate.Thumbprint /s My /fd SHA256 $executables[0].FullName
  if ($LASTEXITCODE -ne 0) { throw 'SignTool failed to sign the Windows test artifact.' }
  & $signTool verify /pa /v $executables[0].FullName
  if ($LASTEXITCODE -ne 0) { throw 'SignTool failed to verify the Windows test artifact.' }

  $reportDirectory = Split-Path -Parent $reportPath
  New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
  $report = [ordered]@{
    schemaVersion = 1
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    testedCommit = $testedCommit
    artifact = $executables[0].Name
    signatureType = 'local-self-signed-test'
    releaseTrusted = $false
    timestamped = $false
    certificateSha256Fingerprint = $certificate.Thumbprint.ToLowerInvariant()
    mainExecutableSha256 = (Get-FileHash -Algorithm SHA256 $executables[0].FullName).Hash.ToLowerInvariant()
    verification = 'signtool verify /pa /v'
  }
  $report | ConvertTo-Json -Depth 4 | Set-Content -Path $reportPath -Encoding utf8
  Write-Output "Windows local test signature verified: $($executables[0].Name)"
}
finally {
  if ($null -ne $certificate) {
    Remove-Item -Path "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -Force -ErrorAction SilentlyContinue
  }
}
