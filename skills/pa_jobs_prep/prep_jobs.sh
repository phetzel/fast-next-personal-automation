#!/usr/bin/env bash

set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [payload.json|-]" >&2
  exit 1
fi

if [[ -z "${PERSONAL_AUTOMATIONS_API_BASE_URL:-}" ]]; then
  echo "PERSONAL_AUTOMATIONS_API_BASE_URL is required" >&2
  exit 1
fi

if [[ -z "${PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN:-}" ]]; then
  echo "PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN is required" >&2
  exit 1
fi

base_url="${PERSONAL_AUTOMATIONS_API_BASE_URL%/}"
endpoint="${base_url}/api/v1/integrations/openclaw/jobs/prep-batch"
payload_path="${1:-}"

if [[ -n "${payload_path}" && "${payload_path}" != "-" && ! -f "${payload_path}" ]]; then
  echo "Payload file not found: ${payload_path}" >&2
  exit 1
fi

data_arg="@-"
if [[ -n "${payload_path}" && "${payload_path}" != "-" ]]; then
  data_arg="@${payload_path}"
fi

set +e
response="$(
  curl \
    --fail-with-body \
    --silent \
    --show-error \
    --connect-timeout 10 \
    --max-time 60 \
    --write-out $'\n%{http_code}' \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "X-Integration-Token: ${PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN}" \
    --data-binary "${data_arg}" \
    "${endpoint}"
)"
curl_status=$?
set -e

http_code="${response##*$'\n'}"
body="${response%$'\n'*}"

if [[ -n "${body}" ]]; then
  printf '%s\n' "${body}"
fi

if [[ ${curl_status} -ne 0 ]]; then
  exit "${curl_status}"
fi

case "${http_code}" in
  2??) ;;
  *) exit 1 ;;
esac
