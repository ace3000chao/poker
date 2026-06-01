@echo off
chcp 65001 >nul
setlocal
set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%
cd /d "%ROOT%\backend" || (echo CANNOT FIND backend folder & pause & exit /b)
set FLASK_ENV=dev
set FLASK_APP=app.py
echo ============================================
echo    我们的王牌 —— 后端服务
echo    http://localhost:5000
echo ============================================
call .venv\Scripts\activate
flask run
pause