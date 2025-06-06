
#!/bin/bash

set -e

echo "Starting database migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

# Run migrations
echo "Applying indexes..."
psql "$DATABASE_URL" -f migrations/001_add_indexes.sql

echo "Applying query optimizations..."
psql "$DATABASE_URL" -f migrations/002_query_optimization.sql

# Push schema changes
echo "Pushing schema changes..."
npm run db:push

echo "Database migration completed successfully!"
