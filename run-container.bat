@echo off
docker build -t bpmn-cpi-simulation .
docker run --rm -p 8080:8080 bpmn-cpi-simulation
