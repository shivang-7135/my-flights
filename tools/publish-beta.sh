#!/bin/sh
# Publishes the current commit as the BETA app:  https://<user>.github.io/my-flights-beta/
# The beta is a separate copy with its own name, its own offline files and its own tickets.
# Usage:  tools/publish-beta.sh <github-user>
set -e
USER_NAME="$1"; [ -n "$USER_NAME" ] || { echo "usage: $0 <github-user>"; exit 1; }
ROOT="$(git rev-parse --show-toplevel)"; REV="$(git rev-parse --short HEAD)"
OUT="$(mktemp -d)"
git -C "$ROOT" archive HEAD | tar -x -C "$OUT"
cd "$OUT"
rm -rf tools
sed -i '' 's/"name": "My Flights"/"name": "My Flights Beta"/; s/"short_name": "My Flights"/"short_name": "Flights Beta"/' manifest.json
sed -i '' 's/apple-mobile-web-app-title" content="My Flights"/apple-mobile-web-app-title" content="Flights Beta"/; s/<h1>My Flights<\/h1>/<h1>My Flights <small class="beta">beta<\/small><\/h1>/' index.html
git init -q -b main
git config user.name "$(git -C "$ROOT" config user.name)"; git config user.email "$(git -C "$ROOT" config user.email)"
git add -A && git commit -q -m "Beta build from $REV"
git push -q -f "https://github.com/$USER_NAME/my-flights-beta.git" main
echo "published beta from $REV"
