#!/usr/bin/env bash
set -e

echo "🚀 Deploying Source Translation Tool to Toolforge..."
git pull
npm install
npm run build
toolforge webservice --backend=kubernetes node18 restart
echo "✅ Deployment complete!"
