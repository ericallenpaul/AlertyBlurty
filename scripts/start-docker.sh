#!/usr/bin/env sh
set -eu

ENV_FILE=".env"
COMPOSE_FILE=""
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

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
  case "$ENV_FILE" in
    /*) ENV_PATH="$ENV_FILE" ;;
    *) ENV_PATH="$PROJECT_ROOT/$ENV_FILE" ;;
  esac
else
  case "$ENV_FILE" in
    /*) ENV_PATH="$ENV_FILE" ;;
    *) ENV_PATH="$PROJECT_ROOT/$ENV_FILE" ;;
  esac
fi

if [ ! -f "$ENV_PATH" ]; then
  cp "$PROJECT_ROOT/.env.example" "$ENV_PATH"
  echo "Created $ENV_FILE from .env.example. Review it before production use."
fi

if [ -n "$COMPOSE_FILE" ]; then
  docker compose --project-directory "$PROJECT_ROOT" --env-file "$ENV_PATH" -f "$PROJECT_ROOT/docker-compose.external-db.yml" up -d
else
  docker compose --project-directory "$PROJECT_ROOT" --env-file "$ENV_PATH" up -d
fi

PORT="$(sed -n 's/^[[:space:]]*ALERTYBLURTY_PORT[[:space:]]*=[[:space:]]*//p' "$ENV_PATH" | tail -n 1 | tr -d '\"' | tr -d \"'\" || true)"
if [ -z "$PORT" ]; then
  PORT="18080"
fi

echo
echo "AlertyBlurty is running."
echo "Open http://localhost:$PORT and complete first-run setup."
echo
echo "View logs with: docker compose logs -f alertyblurty"
