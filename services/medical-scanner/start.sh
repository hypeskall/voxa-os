#!/bin/sh
set -eu
test -n "${MEDICAL_SCANNER_SECRET:-}"
# A database download must succeed on first startup. Do not start with an empty
# engine. The request handler separately rejects definitions older than 48h.
freshclam --quiet
freshclam --daemon --quiet &
clamd --config-file=/etc/clamav/clamd.conf &
exec node /app/server.mjs
