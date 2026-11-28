#!/usr/bin/env bash
set -euo pipefail
# This reviewed launcher is installed beside the pinned unit, by the operator.
# Never turn on shell tracing while loading credentials.
: "${CREDENTIALS_DIRECTORY:?systemd credentials unavailable}"
: "${STATE_DIRECTORY:?systemd state unavailable}"
: "${PORT:?missing service port}"
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] && ((10#$PORT>=1 && 10#$PORT<=65535))
load_credential() {
  local var=$1 name=$2 optional=$3 file value
  file="$CREDENTIALS_DIRECTORY/$name"
  if [[ ! -e "$file" && "$optional" == yes ]]; then return; fi
  [[ -f "$file" && -r "$file" ]]
  value=$(< "$file")
  [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* ]]
  printf -v "$var" '%s' "$value"
  export "$var"
}
load_credential ETF_GUI_PROVIDER_KEY primary-api.key no
load_credential ETF_OPENAI_API_KEY openai-backup.key yes
load_credential ETF_GUI_GEMINI_FREE_API_KEY gemini-free.key yes
load_credential WEB_RESEARCH_YUANBAO_API_KEY yuanbao-search.key yes
exec /opt/node-26.11.1/bin/node dist/src/gui-cli.mjs --project "$STATE_DIRECTORY" --port "$PORT" \
  --live-config "$CREDENTIALS_DIRECTORY/live-config.json"
