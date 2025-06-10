#!/bin/bash

# Exit on any error
set -e

# Navigate to project directory
cd "/Users/copp1723/Desktop/workingprojects/CCL 3"

echo "🧹 Starting FlexPath cleanup commit process..."
echo ""

# Check current git status
echo "📋 Current git status:"
git status --short

echo ""
echo "📦 Adding modified files to staging..."

# Add the files we modified for FlexPath cleanup
git add server/index.ts
git add server/index-robust.ts  
git add .env.example
git add render.yaml

echo "✅ Files staged for commit"

echo ""
echo "📝 Creating commit..."

# Create comprehensive commit message
git commit -m "Clean: Remove FlexPath references and finalize deployment config

🧹 FlexPath cleanup:
- Remove FLEXPATH_API_KEY references from server authentication
- Clean up environment variable configurations  
- Simplify API key validation to use CCL_API_KEY || API_KEY fallback
- Update render.yaml to remove FlexPath environment variables

🚀 Deployment improvements:
- Robust server with graceful startup handling
- Database connection with fallback storage
- Progressive service loading to prevent crashes
- Enhanced error handling for production deployment

✅ Codebase now focused purely on CCL functionality
🎯 Ready for successful Render deployment with all environment variables configured"

echo "✅ Commit created successfully!"

echo ""
echo "🌐 Pushing to GitHub..."

# Push to main branch
git push origin main

echo "✅ Changes pushed to GitHub successfully!"

echo ""
echo "🎉 COMMIT AND PUSH COMPLETED!"
echo ""
echo "📊 Summary of changes:"
echo "  🧹 FlexPath references removed from codebase"
echo "  🔧 API key validation simplified"
echo "  🚀 Robust deployment configuration ready"
echo "  ✅ All files committed and pushed to GitHub"
echo ""
echo "🎯 Next: Your Render deployment should now work!"
echo "   The latest commit is ready for deployment"
echo "   Monitor Render logs for success indicators"
echo ""
