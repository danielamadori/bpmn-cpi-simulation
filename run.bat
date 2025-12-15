@echo off
setlocal enabledelayedexpansion

set PORT=8080
set SHOW_HELP=0

:parse_args
if "%~1"=="" goto end_parse
if /i "%~1"=="-p" (
    set PORT=%~2
    shift
    shift
    goto parse_args
)
if /i "%~1"=="--port" (
    set PORT=%~2
    shift
    shift
    goto parse_args
)
if /i "%~1"=="-h" set SHOW_HELP=1
if /i "%~1"=="--help" set SHOW_HELP=1
shift
goto parse_args

:end_parse

if %SHOW_HELP%==1 (
    echo Usage: %~nx0 [-p^|--port ^<port^>]
    echo Default port: 8080
    exit /b 0
)

set LOG_DIR=%cd%\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set CONTAINER_NAME=bpmn-cpi-simulation

docker build -t bpmn-cpi-simulation .
docker rm -f %CONTAINER_NAME% >NUL 2>&1
docker run --rm --name %CONTAINER_NAME% -p %PORT%:8080 -v "%LOG_DIR%:/logs" bpmn-cpi-simulation
