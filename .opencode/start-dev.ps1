$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\isaha\Downloads\Nisan Ayı Faaliyet (1) (1)\personal-cloud-platform'
$envFile = Join-Path (Get-Location) 'infra/docker/.env'
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { return }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim()
  [Environment]::SetEnvironmentVariable($key, $value, 'Process')
}
$env:RUNTIME_DEFAULT_IMAGE = 'node:20-alpine'
corepack pnpm dev
