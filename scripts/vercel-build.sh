#!/usr/bin/env bash
set -euo pipefail

if [ -d frontend ]; then
  cd frontend
  npm run build
  cd ..
  rm -rf .next
  cp -R frontend/.next .next
else
  npm run build
fi

if [ -f .next/routes-manifest.json ]; then
  cp .next/routes-manifest.json .next/routes-manifest-deterministic.json
else
  cat > .next/routes-manifest-deterministic.json <<'EOF'
{
  "version": 3,
  "pages404": true,
  "caseSensitive": false,
  "basePath": "",
  "redirects": [],
  "headers": [],
  "rewrites": {
    "beforeFiles": [],
    "afterFiles": [],
    "fallback": []
  },
  "dynamicRoutes": [],
  "staticRoutes": [],
  "dataRoutes": []
}
EOF
fi
