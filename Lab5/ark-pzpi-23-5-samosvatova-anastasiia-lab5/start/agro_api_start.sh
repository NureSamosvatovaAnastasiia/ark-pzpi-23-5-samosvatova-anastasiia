#!/bin/bash

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed. Install it and try again."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is not installed. Install it and try again."; exit 1; }

echo "Docker and Docker Compose found."

read -p "Enter POSTGRES USER [myuser]: " POSTGRES_USER
POSTGRES_USER=${POSTGRES_USER:-myuser}

read -sp "Enter POSTGRES PASSWORD [mypassword]: " POSTGRES_PASSWORD
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-mypassword}
echo

read -p "Enter POSTGRES DB NAME [agro_db]: " POSTGRES_DB
POSTGRES_DB=${POSTGRES_DB:-agro_db}

read -p "Enter API PORT [3000]: " API_PORT
API_PORT=${API_PORT:-3000}

read -p "Enter JWT SECRET [demo_secret]: " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-demo_secret}

export POSTGRES_USER
export POSTGRES_PASSWORD
export POSTGRES_DB
export API_PORT
export JWT_SECRET

echo "Environment variables set:"
echo "   POSTGRES_USER=$POSTGRES_USER"
echo "   POSTGRES_DB=$POSTGRES_DB"
echo "   API_PORT=$API_PORT"

docker-compose -f docker-compose.server.yml up -d

echo "Containers starting..."
docker-compose -f docker-compose.server.yml ps
