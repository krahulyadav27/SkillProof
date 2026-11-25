$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $projectRoot ".env"
$examplePath = Join-Path $projectRoot ".env.example"

$ignored = git -C $projectRoot check-ignore -q .env
if ($LASTEXITCODE -ne 0) {
    throw ".env is not ignored by Git. Review .gitignore before continuing."
}

if (-not (Test-Path -LiteralPath $envPath)) {
    if (-not (Test-Path -LiteralPath $examplePath)) {
        throw "Missing .env.example at $examplePath"
    }
    Copy-Item -LiteralPath $examplePath -Destination $envPath
}

$credential = Get-Credential -UserName "postgres" -Message "Enter the password for your confirmed local PostgreSQL role. The password is masked and will not be echoed."
if (-not $credential.UserName) {
    throw "A PostgreSQL role name is required."
}

$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential.Password)
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $encodedUser = [Uri]::EscapeDataString($credential.UserName)
    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $databaseUrl = "postgresql://${encodedUser}:${encodedPassword}@127.0.0.1:5432/skillproof"

    $lines = @(Get-Content -LiteralPath $envPath)
    $databaseLine = "DATABASE_URL=$databaseUrl"
    $matches = @($lines | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' })
    if ($matches.Count -gt 0) {
        $updated = $false
        $lines = @($lines | ForEach-Object {
            if (-not $updated -and $_ -match '^\s*DATABASE_URL\s*=') {
                $updated = $true
                $databaseLine
            } elseif ($_ -notmatch '^\s*DATABASE_URL\s*=') {
                $_
            }
        })
    } else {
        $lines += $databaseLine
    }
    Set-Content -LiteralPath $envPath -Value $lines -Encoding utf8
} finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $plainPassword = $null
    $databaseUrl = $null
}

Write-Host "Local PostgreSQL connection saved to .env for database skillproof on 127.0.0.1:5432. The URL was not printed."
