@echo off
set LOG_DIR=%cd%\logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set CONTAINER_NAME=bpmn-cpi-simulation
docker build -t bpmn-cpi-simulation .
docker rm -f %CONTAINER_NAME% >NUL 2>&1
docker run --rm --name %CONTAINER_NAME% -p 8080:8080 -v "%LOG_DIR%:/logs" bpmn-cpi-simulation
