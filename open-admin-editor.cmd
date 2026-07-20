@echo off
setlocal
set "ASHENHOLD_EDITOR_DIR=%~dp0"
set "ASHENHOLD_EDITOR_PORT=4174"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the local Ashenhold Forge bridge.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "$expected=[IO.Path]::GetFullPath($env:ASHENHOLD_EDITOR_DIR).TrimEnd([IO.Path]::DirectorySeparatorChar); $ports=@(4174,4184,4194,4204,4214); $chosen=''; foreach($p in $ports){ try { $r=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$p+'/__admin/session') -TimeoutSec 1; $actual=[IO.Path]::GetFullPath([string]$r.repositoryRoot).TrimEnd([IO.Path]::DirectorySeparatorChar); if($r.localOnly -and $r.publishConfigured -and [string]::Equals($actual,$expected,[StringComparison]::OrdinalIgnoreCase)){ $chosen=[string]$p; break } } catch { if(-not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)){ $chosen=[string]$p; break } } }; if(-not $chosen){ throw 'No publish-capable editor port is available.' }; Write-Output $chosen"`) do set "ASHENHOLD_EDITOR_PORT=%%p"

powershell -NoProfile -Command "$p=%ASHENHOLD_EDITOR_PORT%; $expected=[IO.Path]::GetFullPath($env:ASHENHOLD_EDITOR_DIR).TrimEnd([IO.Path]::DirectorySeparatorChar); try { $r=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$p+'/__admin/session') -TimeoutSec 1; $actual=[IO.Path]::GetFullPath([string]$r.repositoryRoot).TrimEnd([IO.Path]::DirectorySeparatorChar); $running=$r.localOnly -and $r.publishConfigured -and [string]::Equals($actual,$expected,[StringComparison]::OrdinalIgnoreCase) } catch { $running=$false }; if(-not $running){ Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'tools/ashenhold-admin-server.mjs',('--port='+$p),'--allow-publish','--publish-branch=main' -WorkingDirectory $expected; $ready=$false; for($i=0;$i -lt 30;$i++){ Start-Sleep -Milliseconds 150; try { $r=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$p+'/__admin/session') -TimeoutSec 1; $actual=[IO.Path]::GetFullPath([string]$r.repositoryRoot).TrimEnd([IO.Path]::DirectorySeparatorChar); if($r.localOnly -and $r.publishConfigured -and [string]::Equals($actual,$expected,[StringComparison]::OrdinalIgnoreCase)){$ready=$true;break} } catch {} }; if(-not $ready){ throw 'The publish-capable editor bridge did not start for this worktree.' } }"
if errorlevel 1 (
  echo The Ashenhold Forge bridge could not be started.
  pause
  exit /b 1
)

set "ASHENHOLD_EDITOR_URL=http://127.0.0.1:%ASHENHOLD_EDITOR_PORT%/?admin"
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "Ashenhold Forge" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="%ASHENHOLD_EDITOR_URL%" --start-maximized
  exit /b 0
)
if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  start "Ashenhold Forge" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app="%ASHENHOLD_EDITOR_URL%" --start-maximized
  exit /b 0
)
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "Ashenhold Forge" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="%ASHENHOLD_EDITOR_URL%" --start-maximized
  exit /b 0
)
start "Ashenhold Forge" "%ASHENHOLD_EDITOR_URL%"
endlocal
