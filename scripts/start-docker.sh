#!/usr/bin/env sh
set -eu

ENV_FILE=".env"
COMPOSE_FILE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --external-db)
      COMPOSE_FILE="-f docker-compose.external-db.yml"
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  echo "Created $ENV_FILE from .env.example. Review it before production use."
fi

if [ -n "$COMPOSE_FILE" ]; then
  docker compose --env-file "$ENV_FILE" $COMPOSE_FILE up -d
else
  docker compose --env-file "$ENV_FILE" up -d
fi

PORT="$(sed -n 's/^[[:space:]]*ALERTYBLURTY_PORT[[:space:]]*=[[:space:]]*//p' "$ENV_FILE" | tail -n 1 | tr -d '\"' | tr -d \"'\" || true)"
if [ -z "$PORT" ]; then
  PORT="18080"
fi

echo
echo "AlertyBlurty is running."
echo "Open http://localhost:$PORT and complete first-run setup."
echo
echo "View logs with: docker compose logs -f alertyblurty"
