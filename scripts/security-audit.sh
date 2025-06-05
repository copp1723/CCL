
#!/bin/bash

echo "🔍 Running security audit..."

# Check for npm vulnerabilities
echo "Checking npm audit..."
npm audit --audit-level=moderate

# Update browserslist database
echo "Updating browserslist database..."
npx update-browserslist-db@latest

# Check for outdated dependencies
echo "Checking for outdated dependencies..."
npm outdated

echo "✅ Security audit complete"
