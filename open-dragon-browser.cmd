@echo off
setlocal
set "ASHENHOLD_DIR=%~dp0"
set "ASHENHOLD_PAGE="

where python >nul 2>nul
if errorlevel 1 goto useProd

rem Pick a port that already serves Ashenhold, else start python on a free one.
rem 4173 is preferred; if another app occupies it, fall back to 4181.
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "$ports=@(4173,4181); $chosen=''; foreach($p in $ports){ try { $html=(Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:'+$p+'/index.html') -TimeoutSec 2).Content; if($html -match 'Ashenhold'){ $chosen=[string]$p; break } } catch {} }; if(-not $chosen){ $chosen='4173'; if(Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue){ $chosen='4181' }; Start-Process -WindowStyle Hidden -FilePath 'python' -ArgumentList '-m','http.server',$chosen,'--bind','127.0.0.1' -WorkingDirectory '%ASHENHOLD_DIR%'; Start-Sleep -Milliseconds 900 }; Write-Output $chosen"`) do set "ASHENHOLD_PORT=%%p"
set "ASHENHOLD_PAGE=http://127.0.0.1:%ASHENHOLD_PORT%/"
goto openBrowser

:useProd
set "ASHENHOLD_PAGE=https://dragon-browser-nine.vercel.app"

:openBrowser
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
  start "Ashenhold Browser" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app="%ASHENHOLD_PAGE%" --start-maximized
  exit /b
)

if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
  start "Ashenhold Browser" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app="%ASHENHOLD_PAGE%" --start-maximized
  exit /b
)

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
  start "Ashenhold Browser" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app="%ASHENHOLD_PAGE%" --start-maximized
  exit /b
)

start "Ashenhold Browser" "%ASHENHOLD_PAGE%"
endlocal
