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
$tamperedExecutablePath = Join-Path ([IO.Path]::GetTempPath()) "si-world-phase-14-tampered-$([guid]::NewGuid().ToString('N')).exe"
try {
  $certificate = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject 'CN=SI World Phase 14 Local Test' `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -HashAlgorithm SHA256 `
    -KeyExportPolicy NonExportable `
    -NotAfter (Get-Date).AddDays(2)
  $sdkBinRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  $signTools = @(
    Get-ChildItem -Path $sdkBinRoot -Filter 'signtool.exe' -File -Recurse -ErrorAction Stop |
      Where-Object { $_.Directory.Name -eq 'x64' } |
      Sort-Object -Property FullName -Descending
  )
  if ($signTools.Count -eq 0) {
    throw "Could not find the x64 Windows SDK SignTool under $sdkBinRoot."
  }
  $signTool = $signTools[0].FullName
  & $signTool sign /sha1 $certificate.Thumbprint /s My /fd SHA256 $executables[0].FullName
  if ($LASTEXITCODE -ne 0) { throw 'SignTool failed to sign the Windows test artifact.' }
  $signature = Get-AuthenticodeSignature -LiteralPath $executables[0].FullName
  if ($null -eq $signature.SignerCertificate -or $signature.SignerCertificate.Thumbprint -ne $certificate.Thumbprint) {
    throw 'The Windows test artifact signer does not match the generated test certificate.'
  }
  $expectedUntrustedRoot = $signature.Status -eq 'UnknownError' -and `
    $signature.StatusMessage -match 'root certificate.+not trusted'
  if ($signature.Status -notin @('Valid', 'NotTrusted') -and -not $expectedUntrustedRoot) {
    throw "The Windows test artifact signature is not intact: $($signature.Status): $($signature.StatusMessage)"
  }

  Copy-Item -LiteralPath $executables[0].FullName -Destination $tamperedExecutablePath -Force
  $tamperedBytes = [IO.File]::ReadAllBytes($tamperedExecutablePath)
  if ($tamperedBytes.Length -le 4096) { throw 'The Windows test artifact is too small for the tamper check.' }
  $tamperedBytes[4096] = $tamperedBytes[4096] -bxor 1
  [IO.File]::WriteAllBytes($tamperedExecutablePath, $tamperedBytes)
  $tamperedSignature = Get-AuthenticodeSignature -LiteralPath $tamperedExecutablePath
  if ($tamperedSignature.Status -ne 'HashMismatch') {
    throw "The Windows test signature did not detect a changed executable: $($tamperedSignature.Status)."
  }

  $sha256 = [Security.Cryptography.SHA256]::Create()
  try {
    $certificateSha256Fingerprint = ([BitConverter]::ToString($sha256.ComputeHash($certificate.RawData))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $sha256.Dispose()
  }

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
    certificateSha1Thumbprint = $certificate.Thumbprint.ToLowerInvariant()
    certificateSha256Fingerprint = $certificateSha256Fingerprint
    mainExecutableSha256 = (Get-FileHash -Algorithm SHA256 $executables[0].FullName).Hash.ToLowerInvariant()
    verification = "Get-AuthenticodeSignature $($signature.Status); expectedUntrustedRoot=$expectedUntrustedRoot; tampered copy HashMismatch"
  }
  $report | ConvertTo-Json -Depth 4 | Set-Content -Path $reportPath -Encoding utf8
  Write-Output "Windows local test signature integrity checked: $($executables[0].Name)"
}
finally {
  if ($null -ne $certificate) {
    Remove-Item -Path "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tamperedExecutablePath -Force -ErrorAction SilentlyContinue
}
