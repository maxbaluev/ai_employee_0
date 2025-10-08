@echo off
@echo off
setlocal

REM Navigate to the repository root
cd /d %~dp0\..

REM Activate the virtual environment if it exists
if exist agent\.venv\Scripts\activate.bat (
    call agent\.venv\Scripts\activate.bat
)

set HOST=%HOST:=%
if "%HOST%"=="" set HOST=0.0.0.0
set PORT=%PORT:%=%
if "%PORT%"=="" set PORT=8000

python -m uvicorn agent.agent:app --host %HOST% --port %PORT% %*

endlocal
