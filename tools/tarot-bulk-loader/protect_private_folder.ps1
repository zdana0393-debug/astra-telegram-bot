param(
    [Parameter(Mandatory=$true)][string]$Path,
    [switch]$CheckOnly,
    [switch]$NewEmptyBuild,
    [string]$ExpectedParent
)
$ErrorActionPreference = 'Stop'
# No owner/SACL/parent changes. Only a caller-created EMPTY build-* may be repaired.
# Diagnostics contain counts and fixed categories, never paths, account names or SIDs.
function Invoke-Dacl([string[]]$Arguments) {
    try {
        & $script:icacls @Arguments /Q 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'PRIVATE_DACL_WRITE_FAILED' }
    } catch { throw 'PRIVATE_DACL_WRITE_FAILED' }
}
try {
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PRIVATE_PATH_LINK' }
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $allowed = @($sid.Value, 'S-1-5-18', 'S-1-5-32-544')
    $before = Get-Acl -LiteralPath $Path
    if ($before.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value) { throw 'PRIVATE_OWNER_MISMATCH' }
    $beforeRules = $before.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    $counts = @{ explicit_allow=0; explicit_deny=0; inherited_extra=0; everyone=0; authenticated_users=0; users=0; other=0 }
    foreach ($rule in $beforeRules) {
        $value = $rule.IdentityReference.Value
        if ($allowed -contains $value) { continue }
        if ($rule.IsInherited) { $counts.inherited_extra++ }
        elseif ($rule.AccessControlType -eq 'Allow') { $counts.explicit_allow++ }
        else { $counts.explicit_deny++ }
        switch ($value) {
            'S-1-1-0' { $counts.everyone++ }
            'S-1-5-11' { $counts.authenticated_users++ }
            'S-1-5-32-545' { $counts.users++ }
            default { $counts.other++ }
        }
    }
    [Console]::Out.WriteLine(('ASTRA_DACL_DIAG explicit_allow={0} explicit_deny={1} inherited_extra={2} everyone={3} authenticated_users={4} users={5} other={6}' -f $counts.explicit_allow,$counts.explicit_deny,$counts.inherited_extra,$counts.everyone,$counts.authenticated_users,$counts.users,$counts.other))
    if (-not $CheckOnly) {
        if (-not $item.PSIsContainer) { throw 'DIRECTORY_REQUIRED' }
        if (-not $NewEmptyBuild -or $item.Name -notmatch '^build-[A-Za-z0-9_-]+$' -or [string]::IsNullOrWhiteSpace($ExpectedParent)) { throw 'PRIVATE_NEW_BUILD_REQUIRED' }
        $parent = Get-Item -LiteralPath $ExpectedParent -Force
        if (-not $parent.PSIsContainer -or ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PRIVATE_PARENT_MISMATCH' }
        if (-not [string]::Equals($item.Parent.FullName,$parent.FullName,[StringComparison]::OrdinalIgnoreCase)) { throw 'PRIVATE_PARENT_MISMATCH' }
        if (@(Get-ChildItem -LiteralPath $item.FullName -Force).Count -ne 0) { throw 'PRIVATE_BUILD_NOT_EMPTY' }
        $script:icacls = Join-Path $env:SystemRoot 'System32\icacls.exe'
        if (-not (Test-Path -LiteralPath $script:icacls -PathType Leaf)) { throw 'ICACLS_REQUIRED' }
        $arguments = @($item.FullName, '/inheritance:r', '/grant:r')
        foreach ($value in $allowed) { $arguments += "*${value}:(OI)(CI)F" }
        Invoke-Dacl $arguments
        # /grant:r replaces ONLY named principals. Explicit strangers survive it.
        $remaining = (Get-Acl -LiteralPath $Path).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
        $extra = @($remaining | Where-Object { $allowed -notcontains $_.IdentityReference.Value } | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
        if ($extra.Count -gt 128) { throw 'PRIVATE_DACL_COMPLEX' }
        if ($extra.Count -gt 0) {
            $arguments = @($item.FullName, '/remove')
            foreach ($value in $extra) { $arguments += "*$value" }
            Invoke-Dacl $arguments
        }
        # Remove denies for allowed principals too, only in this new empty folder.
        $arguments = @($item.FullName, '/remove:d')
        foreach ($value in $allowed) { $arguments += "*$value" }
        Invoke-Dacl $arguments
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
        if ($item.PSIsContainer -and ($rule.IsInherited -or (($rule.InheritanceFlags -band $inherit) -ne $inherit))) { throw 'PRIVATE_ACL_CHILDREN' }
        $confirmed[$rule.IdentityReference.Value] = $true
    }
    foreach ($value in $allowed) {
        if (-not $confirmed.ContainsKey($value)) { throw 'PRIVATE_ACL_PRINCIPAL_MISSING' }
    }
    if (-not $CheckOnly -and @(Get-ChildItem -LiteralPath $item.FullName -Force).Count -ne 0) { throw 'PRIVATE_BUILD_NOT_EMPTY' }
    [Console]::Out.WriteLine('ASTRA_DACL_OK')
    exit 0
} catch {
    $code = $_.Exception.Message
    $known = @('PRIVATE_PATH_LINK','PRIVATE_OWNER_MISMATCH','DIRECTORY_REQUIRED','PRIVATE_NEW_BUILD_REQUIRED','PRIVATE_PARENT_MISMATCH','PRIVATE_BUILD_NOT_EMPTY','ICACLS_REQUIRED','PRIVATE_DACL_WRITE_FAILED','PRIVATE_DACL_COMPLEX','PRIVATE_DACL_INHERITANCE','PRIVATE_ACL_DENY','PRIVATE_ACL_TOO_BROAD','PRIVATE_ACL_INCOMPLETE','PRIVATE_ACL_PROPAGATION','PRIVATE_ACL_CHILDREN','PRIVATE_ACL_PRINCIPAL_MISSING')
    if ($known -notcontains $code) { $code = 'PRIVATE_DACL_UNEXPECTED' }
    [Console]::Error.WriteLine("ASTRA_DACL_ERROR:$code")
    exit 1
}
