#!/usr/bin/env bash
docker build -t bpmn-cpi-simulation .
docker run --rm -it -p 8080:8080 bpmn-cpi-simulation
