param([Parameter(Mandatory=$true)][string]$Path, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
# Only a new local release directory is changed. No service/network calls.
$item = Get-Item -LiteralPath $Path -Force
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PRIVATE_PATH_LINK' }
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$allowed = @($sid.Value, 'S-1-5-18', 'S-1-5-32-544')
if (-not $CheckOnly) {
    if (-not $item.PSIsContainer) { throw 'DIRECTORY_REQUIRED' }
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetOwner($sid)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($value in $allowed) {
        $identity = New-Object System.Security.Principal.SecurityIdentifier($value)
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
$actual = Get-Acl -LiteralPath $Path
$rules = $actual.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
$ownerAllowed = $false
foreach ($rule in $rules) {
    if ($rule.AccessControlType -eq 'Allow') {
        if ($allowed -notcontains $rule.IdentityReference.Value) { throw 'PRIVATE_ACL_TOO_BROAD' }
        if ($rule.IdentityReference.Value -eq $sid.Value) { $ownerAllowed = $true }
    }
}
if (-not $ownerAllowed) { throw 'OWNER_ACCESS_REQUIRED' }
