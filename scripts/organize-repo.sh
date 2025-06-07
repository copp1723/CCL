
#!/bin/bash

# Repository Organization Script
# Ensures proper file organization and structure

echo "🔧 Organizing repository structure..."

# Create necessary directories
mkdir -p docs/{deployment,security,development,assets}
mkdir -p config/environments
mkdir -p archive
mkdir -p tests/{unit,integration,e2e}

# Move environment files
if [ -f .env.example ]; then
    mv .env.example config/environments/
fi

# Create symlink for .env.example in root for convenience
if [ ! -f .env.example ]; then
    ln -s config/environments/.env.example .env.example
fi

# Ensure proper permissions
chmod +x scripts/*.sh

echo "✅ Repository organization complete!"
echo ""
echo "📁 New structure:"
echo "  - docs/ - All documentation"
echo "  - config/ - Configuration files"
echo "  - archive/ - Archived components"
echo "  - tests/ - Organized test files"
echo ""
echo "🚀 Ready for development!"
