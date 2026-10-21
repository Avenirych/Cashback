[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$FingerprintsServiceSid,
  [Parameter(Mandatory=$true)][string]$ReceiptsServiceSid,
  [Parameter(Mandatory=$true)][string]$EnrollmentServiceSid,
  [ValidateSet('Preview','ProvisionAfterSeparateApproval')][string]$Mode='Preview'
)
$ErrorActionPreference='Stop'
$root='C:\approved-registration-infrastructure'
$currentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$services=@($FingerprintsServiceSid,$ReceiptsServiceSid,$EnrollmentServiceSid)
if (($services | Select-Object -Unique).Count -ne 3 -or $services -contains $currentSid -or $services -contains 'S-1-5-18') { throw 'STOP: separate service principals required' }
foreach($sid in $services){
  $null=[Security.Principal.SecurityIdentifier]::new($sid)
  if($sid -notmatch '^S-1-5-80-(\d+-){4}\d+$' -and $sid -notmatch '^S-1-5-21-(\d+-){2}\d+-[1-9]\d{3,}$') { throw 'STOP: dedicated service/local-account SID required; broad built-in principals forbidden' }
}
if(Test-Path -LiteralPath $root){ throw 'STOP: existing infrastructure root requires owner/ACL/content recovery review; no reuse or overwrite' }
if($Mode -eq 'Preview'){
  Write-Output 'PREVIEW ONLY: create protected external root, separate key directories and empty ledger. No keys, passwords, roles, SQL or Docker.'
  return
}
function Protect-Directory([string]$path,[string[]]$writeSids,[string[]]$readSids=@()){
  $acl=[Security.AccessControl.DirectorySecurity]::new()
  $acl.SetOwner([Security.Principal.SecurityIdentifier]::new($currentSid))
  $acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($currentSid,'S-1-5-18')+$writeSids){
    $rule=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
  }
  foreach($sid in $readSids){
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow'))
  }
  Set-Acl -LiteralPath $path -AclObject $acl
}
# No recursive deletion/cleanup on failure. Partial provisioning means STOP and explicit recovery.
$null=New-Item -ItemType Directory -Path $root
Protect-Directory $root @() $services
$purposes=@('fingerprints','receipts','enrollment')
for($i=0;$i -lt 3;$i++){
  $path=Join-Path $root $purposes[$i]
  $null=New-Item -ItemType Directory -Path $path
  Protect-Directory $path @($services[$i])
  $payloads=Join-Path $path 'reviewed-payloads'
  $null=New-Item -ItemType Directory -Path $payloads
  Protect-Directory $payloads @() @($services[$i])
}
$public=Join-Path $root 'public'
$null=New-Item -ItemType Directory -Path $public
Protect-Directory $public @() $services
$ledger=Join-Path $root 'ledger'
$null=New-Item -ItemType Directory -Path $ledger
Protect-Directory $ledger $services
$file=[IO.File]::Open((Join-Path $ledger 'events.jsonl'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $file.Flush($true) } finally { $file.Dispose() }
Write-Output 'Storage provisioned only. No keys/credentials/approvals created. Service SIDs share trusted journal write access; hostile writers/host admins require external control.'
