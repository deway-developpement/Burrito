#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://api.burrito.deway.fr}"
ENDPOINT_PATH="${ENDPOINT_PATH:-/burn-5xx}"
STATUS_CODE="${STATUS_CODE:-500}"
MESSAGE="${MESSAGE:-Manual 5xx alert trigger}"
DURATION_SECONDS="${DURATION_SECONDS:-780}"
RPS="${RPS:-2}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-10}"
HOST_HEADER="${HOST_HEADER:-}"
INSECURE_TLS="${INSECURE_TLS:-false}"
DRY_RUN="${DRY_RUN:-false}"

usage() {
  cat <<'EOF'
Usage: ./scripts/trigger_5xx_alert.sh [options]

Trigger manual 5xx traffic on API Gateway endpoint /burn-5xx.
Useful to intentionally fire the BurritoApiGatewayHigh5xxErrorRate alert.

Options:
  --base-url <url>      Base URL (default: https://api.burrito.deway.fr)
  --path <path>         Endpoint path (default: /burn-5xx)
  --status <code>       5xx status to force (default: 500)
  --message <text>      Error message query param
  --duration <seconds>  Total run time (default: 780, i.e. 13 min)
  --rps <number>        Requests per second (default: 2)
  --timeout <seconds>   Curl timeout per request (default: 10)
  --host <host>         Optional Host header (for local ingress tests)
  --insecure            Allow self-signed TLS certs (curl -k)
  --dry-run             Print request URL only, send nothing
  -h, --help            Show this help

Env overrides:
  BASE_URL, ENDPOINT_PATH, STATUS_CODE, MESSAGE, DURATION_SECONDS, RPS,
  TIMEOUT_SECONDS, HOST_HEADER, INSECURE_TLS, DRY_RUN
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --path)
      ENDPOINT_PATH="$2"
      shift 2
      ;;
    --status)
      STATUS_CODE="$2"
      shift 2
      ;;
    --message)
      MESSAGE="$2"
      shift 2
      ;;
    --duration)
      DURATION_SECONDS="$2"
      shift 2
      ;;
    --rps)
      RPS="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    --host)
      HOST_HEADER="$2"
      shift 2
      ;;
    --insecure)
      INSECURE_TLS="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! [[ "$STATUS_CODE" =~ ^[0-9]+$ ]] || (( STATUS_CODE < 500 || STATUS_CODE > 599 )); then
  echo "Error: --status must be an integer between 500 and 599." >&2
  exit 1
fi

if ! [[ "$DURATION_SECONDS" =~ ^[0-9]+$ ]] || (( DURATION_SECONDS <= 0 )); then
  echo "Error: --duration must be a positive integer." >&2
  exit 1
fi

if ! [[ "$TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || (( TIMEOUT_SECONDS <= 0 )); then
  echo "Error: --timeout must be a positive integer." >&2
  exit 1
fi

if ! awk "BEGIN {exit !($RPS > 0)}"; then
  echo "Error: --rps must be > 0." >&2
  exit 1
fi

INTERVAL_SECONDS="$(awk "BEGIN {printf \"%.6f\", 1/$RPS}")"
TARGET_URL="${BASE_URL%/}${ENDPOINT_PATH}"
END_TS=$(( $(date +%s) + DURATION_SECONDS ))

curl_args=(
  --silent
  --show-error
  --output /dev/null
  --write-out '%{http_code}'
  --max-time "$TIMEOUT_SECONDS"
  --get
  --data-urlencode "status=$STATUS_CODE"
  --data-urlencode "message=$MESSAGE"
)

if [[ "$INSECURE_TLS" == "true" ]]; then
  curl_args+=(--insecure)
fi

if [[ -n "$HOST_HEADER" ]]; then
  curl_args+=(-H "Host: $HOST_HEADER")
fi

echo "Target URL: $TARGET_URL"
echo "Status code: $STATUS_CODE"
echo "Duration: ${DURATION_SECONDS}s"
echo "RPS: $RPS (sleep interval ${INTERVAL_SECONDS}s)"
echo "Note: the 5xx alert uses for=10m, keep this running >= 11-12 minutes."

if [[ "$DRY_RUN" == "true" ]]; then
  echo "Dry-run enabled. No request sent."
  exit 0
fi

sent=0
five_xx=0
other=0
network_errors=0

while (( $(date +%s) < END_TS )); do
  http_code="$(curl "${curl_args[@]}" "$TARGET_URL" || true)"
  ((sent+=1))

  if [[ "$http_code" =~ ^5[0-9][0-9]$ ]]; then
    ((five_xx+=1))
  elif [[ "$http_code" == "000" || -z "$http_code" ]]; then
    ((network_errors+=1))
  else
    ((other+=1))
  fi

  if (( sent % 20 == 0 )); then
    printf 'progress: sent=%d 5xx=%d other=%d net_err=%d\n' \
      "$sent" "$five_xx" "$other" "$network_errors"
  fi

  sleep "$INTERVAL_SECONDS"
done

echo "Done."
printf 'summary: sent=%d 5xx=%d other=%d net_err=%d\n' \
  "$sent" "$five_xx" "$other" "$network_errors"
