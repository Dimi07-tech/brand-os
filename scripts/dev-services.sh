#!/usr/bin/env bash
# Services locaux sans Docker ni sudo : PostgreSQL et Redis dans .dev/
# Usage : scripts/dev-services.sh start|stop|status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV="$ROOT/.dev"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
PGDATA="$DEV/pgdata"
PGPORT=5432
REDIS_PORT=6379

start() {
  mkdir -p "$DEV"
  if [ ! -d "$PGDATA" ]; then
    "$PGBIN/initdb" -D "$PGDATA" -U brandos --auth=scram-sha-256 --pwfile=<(echo brandos) \
      --encoding=UTF8 --locale=C.UTF-8 >/dev/null
    echo "unix_socket_directories = '$DEV'" >> "$PGDATA/postgresql.conf"
  fi
  if ! "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT" -l "$DEV/postgres.log" -w start >/dev/null
    PGPASSWORD=brandos "$PGBIN/psql" -h localhost -p $PGPORT -U brandos -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='brandos'" | grep -q 1 \
      || PGPASSWORD=brandos "$PGBIN/createdb" -h localhost -p $PGPORT -U brandos brandos
  fi
  if ! redis-cli -p $REDIS_PORT ping >/dev/null 2>&1; then
    redis-server --port $REDIS_PORT --dir "$DEV" --daemonize yes \
      --pidfile "$DEV/redis.pid" --logfile "$DEV/redis.log" --save "" >/dev/null
  fi
  status
}

stop() {
  "$PGBIN/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  redis-cli -p $REDIS_PORT shutdown nosave >/dev/null 2>&1 || true
  echo "Services arrêtés."
}

status() {
  if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then echo "postgres : actif (:$PGPORT)"; else echo "postgres : arrêté"; fi
  if redis-cli -p $REDIS_PORT ping >/dev/null 2>&1; then echo "redis    : actif (:$REDIS_PORT)"; else echo "redis    : arrêté"; fi
}

"${1:-status}"
