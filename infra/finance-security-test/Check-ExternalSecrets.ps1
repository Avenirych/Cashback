# Read-only metadata/ACL validation. NEVER reads password bytes or invokes Docker.
[CmdletBinding()]
param(
    [string]$SecretDirectory = 'C:\Users\serge\AppData\Local\CashbackFinanceSecurity9F\secrets'
)
$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$resolved = (Resolve-Path -LiteralPath $SecretDirectory).ProviderPath
$secretPath = [IO.Path]::GetFullPath($resolved)
if ($secretPath.Equals($repoPath, [StringComparison]::OrdinalIgnoreCase) -or
    $secretPath.StartsWith($repoPath + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Secret directory must be outside repository'
}
$directory = Get-Item -LiteralPath $secretPath -Force
if (-not $directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Unexpected directory or reparse point'
}
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
function Assert-RestrictedAcl($Path) {
    $acl = Get-Acl -LiteralPath $Path
    $ownerSid = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    if ($ownerSid -ne $currentSid) { throw 'Unexpected owner: STOP' }
    $readAllowed = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow) {
            if ($rule.IdentityReference.Value -ne $currentSid) { throw 'Additional ACL principal: review required' }
            if ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::ReadData) { $readAllowed = $true }
        }
    }
    if (-not $readAllowed) { throw 'User read allowance absent' }
    # This is ACL inspection, not a proof of effective Linux container access.
}
if (-not (Get-Acl -LiteralPath $secretPath).AreAccessRulesProtected) {
    throw 'Directory inheritance not disabled: review required'
}
Assert-RestrictedAcl $secretPath
foreach ($name in @('bootstrap','installer','runtime','authority','operator')) {
    $item = Get-Item -LiteralPath (Join-Path $secretPath $name) -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne 64) {
        throw 'Missing, unexpected or wrong-size secret file: STOP'
    }
    Assert-RestrictedAcl $item.FullName
}
Write-Output 'PASS five 64-byte files and restricted ACL metadata; contents NOT read'
