#!/bin/bash

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed. Install it and try again."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is not installed. Install it and try again."; exit 1; }

echo "Docker and Docker Compose found."

read -p "Enter USER EMAIL [anastasiia.samosvatova@nure.ua]: " USER_EMAIL
USER_EMAIL=${USER_EMAIL:-anastasiia.samosvatova@nure.ua}

read -sp "Enter USER PASSWORD [string]: " USER_PASS
USER_PASS=${USER_PASS:-string}
echo

read -p "Enter GREENHOUSE_ID [c9f7ce01-459a-4e66-9870-f90ebfb18f1d]: " GREENHOUSE_ID
GREENHOUSE_ID=${GREENHOUSE_ID:-c9f7ce01-459a-4e66-9870-f90ebfb18f1d}

export USER_EMAIL
export USER_PASS
export GREENHOUSE_ID

echo "Environment variables set:"
echo "   USER_EMAIL=$USER_EMAIL"
echo "   GREENHOUSE_ID=$GREENHOUSE_ID"

docker-compose -f docker-compose.iot.yml up -d

echo "Containers starting..."
docker-compose -f docker-compose.iot.yml ps
