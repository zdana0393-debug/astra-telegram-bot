param([Parameter(Mandatory=$true)][string]$Path, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
# Only DACL on a new, caller-owned directory is changed. Never owner or SACL.
$item = Get-Item -LiteralPath $Path -Force
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PRIVATE_PATH_LINK' }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$allowed = @($sid.Value, 'S-1-5-18', 'S-1-5-32-544')
$before = Get-Acl -LiteralPath $Path
if ($before.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'PRIVATE_OWNER_MISMATCH' }
if (-not $CheckOnly) {
    if (-not $item.PSIsContainer) { throw 'DIRECTORY_REQUIRED' }
    # icacls only changes discretionary permissions here. No /setowner, /setaudit,
    # /restore, /reset or recursion; no elevation or SeSecurityPrivilege needed.
    $icacls = Join-Path $env:SystemRoot 'System32\icacls.exe'
    if (-not (Test-Path -LiteralPath $icacls -PathType Leaf)) { throw 'ICACLS_REQUIRED' }
    $arguments = @($item.FullName, '/inheritance:r', '/grant:r')
    foreach ($value in $allowed) {
        $arguments += "*${value}:(OI)(CI)F"
    }
    & $icacls @arguments /Q 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'PRIVATE_DACL_WRITE_FAILED' }
}
$actual = Get-Acl -LiteralPath $Path
if ($actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'PRIVATE_OWNER_MISMATCH' }
if ($item.PSIsContainer -and -not $actual.AreAccessRulesProtected) { throw 'PRIVATE_DACL_INHERITANCE' }
$rules = $actual.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
$confirmed = @{}
$full = [Security.AccessControl.FileSystemRights]::FullControl
$inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
foreach ($rule in $rules) {
    if ($rule.AccessControlType -ne 'Allow') { throw 'PRIVATE_ACL_DENY' }
    if ($allowed -notcontains $rule.IdentityReference.Value) { throw 'PRIVATE_ACL_TOO_BROAD' }
    if (($rule.FileSystemRights -band $full) -ne $full) { throw 'PRIVATE_ACL_INCOMPLETE' }
    if ($rule.PropagationFlags -ne 'None') { throw 'PRIVATE_ACL_PROPAGATION' }
    if ($item.PSIsContainer -and (($rule.InheritanceFlags -band $inherit) -ne $inherit)) { throw 'PRIVATE_ACL_CHILDREN' }
    $confirmed[$rule.IdentityReference.Value] = $true
}
foreach ($value in $allowed) {
    if (-not $confirmed.ContainsKey($value)) { throw 'PRIVATE_ACL_PRINCIPAL_MISSING' }
}
