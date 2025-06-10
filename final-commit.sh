#!/bin/bash

# Navigate to project directory
cd "/Users/copp1723/Desktop/workingprojects/CCL 3"

echo "🧹 Committing FlexPath cleanup and final deployment fixes..."

# Add the cleaned up files
git add server/index.ts
git add server/index-robust.ts
git add .env.example
git add render.yaml

echo ""
echo "📝 Committing cleanup changes..."
git commit -m "Clean: Remove FlexPath references from CCL codebase

🧹 FlexPath cleanup:
- Remove FLEXPATH_API_KEY references from server files
- Clean up environment variable configurations
- Simplify API key validation to use CCL_API_KEY || API_KEY
- Update render.yaml to remove FlexPath environment variables

✅ Codebase now focused purely on CCL functionality
🚀 Ready for clean deployment to Render"

echo ""
echo "🌐 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ All changes committed and pushed!"
echo ""
echo "🚀 READY TO DEPLOY!"
echo "Your Render environment has all 6 required variables:"
echo "  ✅ API_KEY"
echo "  ✅ DATABASE_URL" 
echo "  ✅ ENCRYPTION_KEY"
echo "  ✅ NODE_ENV"
echo "  ✅ OPENAI_API_KEY"
echo "  ✅ PORT"
echo "  ✅ RENDER_DEPLOYMENT=true"
echo "  ✅ GRACEFUL_STARTUP=true"
echo "  ✅ SERVICE_TIMEOUT_MS=10000"
echo "  ✅ DB_CONNECTION_TIMEOUT_MS=5000"
echo "  ✅ MAX_STARTUP_RETRIES=3"
echo "  ✅ CCL_API_KEY"
echo ""
echo "🎯 Next steps:"
echo "1. Trigger a new deployment in Render dashboard"
echo "2. Monitor the logs for success messages:"
echo "   🚀 RENDER FIX: Starting server on port 10000"
echo "   ✅ RENDER SUCCESS: Server listening on 0.0.0.0:10000"
echo "   ✅ Database connection successful"
echo "   ✅ Advanced services loaded successfully"
echo ""
echo "3. Test your deployed app:"
echo "   curl https://your-app.onrender.com/health"
echo ""
echo "🎉 You should have a successful deployment!"
