#!/usr/bin/env bash

set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [payload.json]" >&2
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
endpoint="${base_url}/api/v1/integrations/openclaw/jobs/ingest"
payload_path="${1:-}"

if [[ -n "${payload_path}" && ! -f "${payload_path}" ]]; then
  echo "Payload file not found: ${payload_path}" >&2
  exit 1
fi

if [[ -n "${payload_path}" ]]; then
  data_arg="@${payload_path}"
else
  data_arg="@-"
fi

curl \
  --fail-with-body \
  --silent \
  --show-error \
  --connect-timeout 10 \
  --max-time 60 \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Integration-Token: ${PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN}" \
  --data-binary "${data_arg}" \
  "${endpoint}"
