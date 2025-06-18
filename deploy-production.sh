#!/bin/bash

# CCL Production Deployment Script
# Optimized build process with error handling and security checks

set -e  # Exit on error

echo "🚀 Starting CCL Production Deployment..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
npm run clean

# Install dependencies with production optimizations
echo "📦 Installing dependencies..."
npm ci --only=production --no-audit --no-fund

# Security audit
echo "🔒 Running security audit..."
npm audit --audit-level moderate || echo "⚠️ Security warnings found - review before deployment"

# Type checking
echo "🔍 Type checking..."
npm run check

# Build client (React/Vite)
echo "🏗️ Building client application..."
npm run build:client

# Build server (Node.js/esbuild)
echo "🏗️ Building server application..."
npm run build:server

# Verify build outputs
echo "✅ Verifying build outputs..."
if [ ! -f "dist/public/index.html" ]; then
    echo "❌ Client build failed - index.html not found"
    exit 1
fi

if [ ! -f "dist/index-robust.js" ]; then
    echo "❌ Server build failed - index-robust.js not found"
    exit 1
fi

# Display build summary
echo "📊 Build Summary:"
echo "   Client bundle: $(du -h dist/public/ | tail -1 | cut -f1)"
echo "   Server bundle: $(du -h dist/index-robust.js | cut -f1)"
echo "   Total size: $(du -sh dist/ | cut -f1)"

echo "✅ Production build completed successfully!"
echo "🚀 Ready for deployment to Render, Railway, or other platforms"