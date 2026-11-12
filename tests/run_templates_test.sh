#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
BASE_URL="${BASE_URL:-http://localhost:3001}" node tests/smoke.mjs
