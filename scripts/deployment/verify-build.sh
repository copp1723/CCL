#!/bin/bash

# CCL Build Verification Script
# Quick verification of build process and dependencies

echo "🔍 CCL Build Verification Starting..."

# Check Node.js and npm versions
echo "📋 Environment Check:"
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"

# Check critical dependencies
echo "📦 Dependency Check:"
if [ -d "node_modules/@rollup" ]; then
    echo "   ✅ Rollup binaries: $(ls node_modules/@rollup/)"
else
    echo "   ❌ Rollup binaries missing"
fi

if [ -d "node_modules/vite" ]; then
    echo "   ✅ Vite installed"
else
    echo "   ❌ Vite missing"
fi

if [ -d "node_modules/esbuild" ]; then
    echo "   ✅ esbuild installed"
else
    echo "   ❌ esbuild missing"
fi

# Check TypeScript compilation
echo "🔍 TypeScript Check:"
npx tsc --noEmit --skipLibCheck && echo "   ✅ TypeScript OK" || echo "   ⚠️ TypeScript warnings"

# Quick build test
echo "🏗️ Quick Build Test:"

# Test server build (fast)
echo "   Testing server build..."
npm run build:server && echo "   ✅ Server build: SUCCESS" || echo "   ❌ Server build: FAILED"

# Test client build (may take longer)
echo "   Testing client build..."
timeout 60 npm run build:client && echo "   ✅ Client build: SUCCESS" || echo "   ⚠️ Client build: TIMEOUT or FAILED"

# Check build outputs
if [ -f "dist/index-robust.js" ]; then
    echo "   ✅ Server bundle created: $(du -h dist/index-robust.js | cut -f1)"
else
    echo "   ❌ Server bundle missing"
fi

if [ -d "dist/public" ]; then
    echo "   ✅ Client bundle created: $(du -sh dist/public | cut -f1)"
else
    echo "   ❌ Client bundle missing"
fi

echo "🏁 Verification Complete!"