#!/bin/bash
# Codex setup script to install all deps before network access is cut

echo "🚀 Starting Codex setup script..."

# Simple check for Node.js and npm
echo "🔍 Checking for Node.js and npm..."

# Try to get versions - if this fails, the commands don't exist
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
NPM_VERSION=$(npm --version 2>/dev/null || echo "not found")

if [ "$NODE_VERSION" = "not found" ]; then
    echo "❌ Node.js is not available in this environment"
    echo "💡 This script requires Node.js to be pre-installed"
    exit 1
fi

if [ "$NPM_VERSION" = "not found" ]; then
    echo "❌ npm is not available in this environment"
    echo "💡 This script requires npm to be pre-installed"
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"
echo "✅ npm version: $NPM_VERSION"

# Install dependencies
echo "📦 Installing node dependencies..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. This doesn't appear to be a Node.js project."
    exit 1
fi

# Install dependencies - use npm install for maximum compatibility
echo "🔧 Running npm install..."
npm install || {
    echo "❌ npm install failed"
    exit 1
}

echo "✅ Node dependencies installed successfully!"

# Optional: Check TypeScript compilation (but don't fail if it has errors)
echo "🔍 Checking TypeScript compilation..."
npm run check 2>/dev/null && echo "✅ TypeScript compilation successful!" || echo "⚠️  TypeScript compilation had issues, but continuing..."

# Check if database migration files exist
if [ -d "migrations" ] && [ "$(ls -A migrations 2>/dev/null)" ]; then
    echo "📊 Database migration files found. Remember to run 'npm run db:migrate' if needed."
fi

# You can add more setup commands if needed
echo "🎉 Setup completed successfully!"
echo "📋 Available scripts:"
echo "  - npm run dev      : Start development server"
echo "  - npm run build    : Build for production"
echo "  - npm run start    : Start production server"
echo "  - npm run test:integration : Run integration tests"
echo "  - npm run db:push  : Push database schema"
echo "  - npm run db:migrate : Run database migrations"
