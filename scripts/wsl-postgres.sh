#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/lib/postgresql/16/bin:${PATH}"
export PGDATA="${HOME}/.shidvar-pg"
mkdir -p "$PGDATA"

ensure_conf() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}[[:space:]]*=" "$PGDATA/postgresql.conf"; then
    sed -i "s|^${key}[[:space:]]*=.*|${key} = ${value}|" "$PGDATA/postgresql.conf"
  else
    echo "${key} = ${value}" >> "$PGDATA/postgresql.conf"
  fi
}

if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
  PWFILE="$(mktemp)"
  printf '%s' 'shidvar' > "$PWFILE"
  initdb -D "$PGDATA" --username=shidvar --pwfile="$PWFILE" --auth=scram-sha-256 --encoding=UTF8 --locale=C
  rm -f "$PWFILE"
fi

ensure_conf listen_addresses "'127.0.0.1'"
ensure_conf port "5433"
ensure_conf unix_socket_directories "'/tmp'"

if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "PostgreSQL already running in $PGDATA"
else
  pg_ctl -D "$PGDATA" -l "$PGDATA/pg.log" start
fi

export PGPASSWORD=shidvar
for _ in 1 2 3 4 5; do
  if psql -h 127.0.0.1 -p 5433 -U shidvar -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! psql -h 127.0.0.1 -p 5433 -U shidvar -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'shidvar'" | grep -q 1; then
  createdb -h 127.0.0.1 -p 5433 -U shidvar shidvar
fi

psql -h 127.0.0.1 -p 5433 -U shidvar -d shidvar -c "SELECT 'wsl_pg_ok' AS status;"
echo "PostgreSQL ready at postgresql://shidvar@127.0.0.1:5433/shidvar"
