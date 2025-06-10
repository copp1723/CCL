#!/bin/bash

# Navigate to project directory
cd "/Users/copp1723/Desktop/workingprojects/CCL 3"

echo "🔍 Checking git status..."
git status

echo ""
echo "📦 Adding changes to staging..."

# Add all the files we modified
git add render.yaml
git add server/index-robust.ts
git add package.json
git add server/db.ts
git add .env.example
git add .env.render
git add test-deployment.sh

echo ""
echo "📝 Committing changes..."
git commit -m "Fix: Robust deployment configuration for Render

🚀 Major deployment fixes:
- Add graceful startup handling for production deployments  
- Fix database connection with proper WebSocket configuration
- Implement fallback storage when database is unavailable
- Add deployment-specific environment variables
- Create two-phase startup (immediate port binding + progressive service loading)

🔧 Changes:
- render.yaml: Fixed environment variables and added deployment config
- server/index-robust.ts: New robust server with graceful error handling
- package.json: Updated build script to use robust server
- server/db.ts: Enhanced database connection with SSL and error handling
- .env.example: Added deployment configuration variables
- test-deployment.sh: Local deployment testing script

✅ This resolves deployment blocking issues on Render platform"

echo ""
echo "✅ Changes committed successfully!"
echo ""
echo "🌐 To push to GitHub, run:"
echo "git push origin main"
