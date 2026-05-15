#!/bin/bash
# Build everything for production deployment.
# Run this locally, then copy the output to your server.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Installing dependencies..."
pnpm install --frozen-lockfile

echo "→ Building API..."
pnpm --filter @meet-vista/api build

echo "→ Building meeting-lab frontend..."
# For same-domain deployment (nginx/Caddy proxying API and frontend),
# VITE_API_URL should be empty so the browser uses relative paths.
# Override: VITE_API_URL="" ./scripts/build-prod.sh
# Or set it in apps/meeting-lab/.env before running this script.
VITE_API_URL="${VITE_API_URL:-}" pnpm --filter @meet-vista/meeting-lab build

echo ""
echo "✓ Build complete."
echo "  API dist:      apps/api/dist/"
echo "  Frontend dist: apps/meeting-lab/dist/"
echo ""
echo "Next steps on the server:"
echo "  1. Copy apps/api/dist/ and apps/api/drizzle/ to the server"
echo "  2. Copy apps/meeting-lab/dist/ to /var/www/vista-meet (or serve via nginx)"
echo "  3. Set env vars in apps/api/.env (see apps/api/.env.example)"
echo "     Required: JWT_SECRET (32+ chars), LIVEKIT_API_KEY, LIVEKIT_API_SECRET"
echo "     For public live test: DEV_SECRET, CORS_ORIGIN"
echo "  4. Run: node --env-file=.env apps/api/dist/db/migrate.js  (first deploy only)"
echo "  5. Run: node --env-file=.env apps/api/dist/index.js"
echo "  (Docker path: see docker-compose.yml + nginx.conf)"
