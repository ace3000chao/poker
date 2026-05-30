$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath "$root\backend"
$env:FLASK_ENV = "dev"
$env:FLASK_APP = "app.py"
Write-Host "============================================"
Write-Host "   our game - backend server"
Write-Host "   http://localhost:5000"
Write-Host "============================================"
$venvActivate = Join-Path -Path (Get-Location) -ChildPath ".venv\Scripts\Activate.ps1"
& $venvActivate
flask run -h 0.0.0.0 -p 5000
Read-Host "Press Enter to exit"