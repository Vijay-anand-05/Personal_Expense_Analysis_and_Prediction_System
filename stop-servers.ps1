param([string]$Root)

# Ownership rule: a listener on port 5000/5173 is stopped only if one of its ancestor
# processes is a cmd.exe whose command line contains this project's folder. run.bat starts
# each server with: cmd /k "cd /d <project>\backend && npm run dev" (and ...\frontend).
# Limitation: if that console window was already closed, the node process is orphaned and
# its ownership can no longer be proven, so it is reported but NOT killed.

$Root = (Resolve-Path $Root).Path.TrimEnd('\')
$ports = @{ 5000 = 'Backend'; 5173 = 'Frontend' }
$warn = 0

function Get-Proc($id) { Get-CimInstance Win32_Process -Filter "ProcessId = $id" -ErrorAction SilentlyContinue }

foreach ($port in $ports.Keys) {
  $name = $ports[$port]
  $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  if ($listeners.Count -eq 0) { Write-Host "$name (port $port): not running."; continue }

  foreach ($pid_ in ($listeners.OwningProcess | Sort-Object -Unique)) {
    $p = Get-Proc $pid_
    $owner = $null
    $cur = $p
    for ($i = 0; $i -lt 8 -and $cur; $i++) {
      if ($cur.Name -eq 'cmd.exe' -and $cur.CommandLine -and $cur.CommandLine.IndexOf($Root, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $owner = $cur; break }
      $cur = Get-Proc $cur.ParentProcessId
    }
    if ($owner) {
      # /T ends the whole tree (cmd window, npm, node); /F forces it.
      taskkill /PID $owner.ProcessId /T /F | Out-Null
      Write-Host "$name (port $port): stopped (PID $($owner.ProcessId) and its child processes)."
    } else {
      Write-Host "$name (port $port): in use by '$($p.Name)' (PID $pid_), which was not started by this project's run.bat. Left running."
      $warn = 1
    }
  }
}
exit $warn
