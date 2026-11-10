#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v app_password="$VOLT_APP_PASSWORD" -v migrator_password="$VOLT_MIGRATOR_PASSWORD" <<'SQL'
CREATE ROLE volt_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE volt_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE volt TO volt_migrator, volt_app;
GRANT CREATE ON SCHEMA public TO volt_migrator;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL