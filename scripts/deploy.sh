#!/bin/sh
# Uploads the static export to the host. The target is private, so it lives in .env.local (see
# .env.example), never in the repo. --delete mirrors out/ exactly: files removed locally go remotely.
set -eu
[ -f .env.local ] && . ./.env.local
: "${DEPLOY_TARGET:?Set DEPLOY_TARGET in .env.local, see .env.example}"
[ -f out/index.html ] || { echo "out/ is missing, run npm run build first" >&2; exit 1; }
rsync -avz --delete out/ "$DEPLOY_TARGET"
