#!/bin/bash

# Database Migration Script
# Complete Car Loans Agent System

set -e

echo "Starting database migration for CCL Agent System..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    exit 1
fi

# Function to run SQL file
run_sql_file() {
    local file=$1
    echo "Running migration: $file"
    
    if [ -f "$file" ]; then
        psql "$DATABASE_URL" -f "$file"
        echo "✅ Completed: $file"
    else
        echo "❌ File not found: $file"
        exit 1
    fi
}

# Function to check database connection
check_connection() {
    echo "Checking database connection..."
    psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Database connection successful"
    else
        echo "❌ Database connection failed"
        exit 1
    fi
}

# Function to backup database
backup_database() {
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo "Creating backup: $backup_file"
    
    pg_dump "$DATABASE_URL" > "$backup_file"
    if [ $? -eq 0 ]; then
        echo "✅ Backup created: $backup_file"
    else
        echo "❌ Backup failed"
        exit 1
    fi
}

# Function to run Drizzle migrations
run_drizzle_migrations() {
    echo "Running Drizzle schema migrations..."
    npm run db:push
    if [ $? -eq 0 ]; then
        echo "✅ Drizzle migrations completed"
    else
        echo "❌ Drizzle migrations failed"
        exit 1
    fi
}

# Main migration process
main() {
    echo "CCL Agent System Database Migration"
    echo "==================================="
    
    # Check dependencies
    command -v psql >/dev/null 2>&1 || { echo "❌ psql is required but not installed"; exit 1; }
    command -v pg_dump >/dev/null 2>&1 || { echo "❌ pg_dump is required but not installed"; exit 1; }
    
    # Check database connection
    check_connection
    
    # Create backup (optional, comment out for development)
    if [ "$NODE_ENV" = "production" ] || [ "$NODE_ENV" = "staging" ]; then
        backup_database
    fi
    
    # Run Drizzle schema migrations first
    run_drizzle_migrations
    
    # Run custom SQL migrations
    echo "Running performance optimization migrations..."
    
    # Add indexes for performance
    run_sql_file "migrations/001_add_indexes.sql"
    
    # Add query optimization views and functions
    run_sql_file "migrations/002_query_optimization.sql"
    
    # Update database statistics
    echo "Updating database statistics..."
    psql "$DATABASE_URL" -c "ANALYZE;"
    
    echo ""
    echo "🎉 Database migration completed successfully!"
    echo ""
    echo "Performance improvements applied:"
    echo "  - Strategic indexes for all major queries"
    echo "  - Materialized views for dashboard statistics"
    echo "  - Optimized functions for common operations"
    echo "  - Database maintenance functions"
    echo ""
    echo "System is ready for production deployment."
}

# Handle script arguments
case "${1:-}" in
    "backup-only")
        check_connection
        backup_database
        ;;
    "indexes-only")
        check_connection
        run_sql_file "migrations/001_add_indexes.sql"
        ;;
    "optimization-only")
        check_connection
        run_sql_file "migrations/002_query_optimization.sql"
        ;;
    "drizzle-only")
        run_drizzle_migrations
        ;;
    *)
        main
        ;;
esac