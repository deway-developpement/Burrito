#!/usr/bin/env bash
set -euo pipefail

OWNER="${OWNER:-deway-developpement}"
REPO="${REPO:-Burrito}"
RULESET_ID="${RULESET_ID:-13297101}"
APP_ID="${APP_ID:-}"

if [ -z "${APP_ID}" ]; then
  echo "APP_ID is required (numeric GitHub App ID)." >&2
  exit 1
fi

if ! [[ "${APP_ID}" =~ ^[0-9]+$ ]]; then
  echo "APP_ID must be numeric." >&2
  exit 1
fi

gh api \
  -X PUT \
  "/repos/${OWNER}/${REPO}/rulesets/${RULESET_ID}" \
  -H "Accept: application/vnd.github+json" \
  --input - <<JSON
{
  "name": "Production only from main",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/production"],
      "exclude": []
    }
  },
  "bypass_actors": [
    {
      "actor_id": ${APP_ID},
      "actor_type": "Integration",
      "bypass_mode": "always"
    }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "update",
      "parameters": {
        "update_allows_fetch_and_merge": false
      }
    }
  ]
}
JSON

echo "Ruleset ${RULESET_ID} updated for ${OWNER}/${REPO} with App ID ${APP_ID}."
