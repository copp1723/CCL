#!/bin/bash

# 🚀 CCL Production Deployment Test Script
# This script simulates Render deployment conditions locally

echo "🧪 CCL Production Deployment Test"
echo "=================================="

# Check for required files
echo "📁 Checking required files..."
required_files=("package.json" "server/index-robust.ts" "render.yaml" "server/db.ts")
for file in "${required_files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file exists"
  else
    echo "❌ $file missing"
    exit 1
  fi
done

# Set production environment variables
echo "🔧 Setting production environment..."
export NODE_ENV=production
export PORT=10000
export RENDER_DEPLOYMENT=true
export GRACEFUL_STARTUP=true
export CCL_API_KEY=test-api-key
export API_KEY=test-api-key

# Test build process
echo "🔨 Testing build process..."
npm run build
if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed"
  exit 1
fi

# Test if server starts and binds to port
echo "🚀 Testing server startup..."
timeout 30s npm start &
SERVER_PID=$!
sleep 5

# Test health check
echo "🏥 Testing health check..."
health_response=$(curl -s http://localhost:10000/health || echo "FAILED")
if [[ $health_response == *"healthy"* ]]; then
  echo "✅ Health check passed"
  echo "📊 Response: $health_response"
else
  echo "❌ Health check failed"
  echo "📊 Response: $health_response"
fi

# Test system status
echo "📈 Testing system status..."
status_response=$(curl -s http://localhost:10000/api/system/status || echo "FAILED")
if [[ $status_response == *"operational"* ]]; then
  echo "✅ System status check passed"
else
  echo "❌ System status check failed"
  echo "📊 Response: $status_response"
fi

# Cleanup
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo ""
echo "🎯 Deployment test completed!"
echo "🚀 If all checks passed, your app is ready for Render deployment"
echo ""
echo "Next steps:"
echo "1. Commit these changes to GitHub"
echo "2. Deploy to Render using the render.yaml blueprint"
echo "3. Monitor the deployment logs for the success messages"
