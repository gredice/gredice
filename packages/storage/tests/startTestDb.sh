#!/bin/zsh
# Start a disposable Postgres test database using Docker and run migrations

# Use an alternative port (5433) to avoid collision with local Postgres
TEST_DB_PORT=5433

# Stop and remove any existing test DB container to avoid name conflicts
docker rm -f gredice-test-db 2>/dev/null || true

docker run --rm -d \
  --name gredice-test-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=gredice_test \
  -p $TEST_DB_PORT:5432 \
  postgres:16

# Wait for Postgres to be ready
until docker exec gredice-test-db pg_isready -U postgres -d gredice_test; do
  sleep 1
done

export POSTGRES_URL="postgres://postgres:postgres@localhost:$TEST_DB_PORT/gredice_test"
echo "POSTGRES_URL set to $POSTGRES_URL"
# Append POSTGRES_URL and TEST_ENV=1 to .env.test file
echo "POSTGRES_URL=$POSTGRES_URL" > "$(dirname "$0")/../.env.test"
echo "TEST_ENV=1" >> "$(dirname "$0")/../.env.test"

# Run migrations (from the storage package root)
cd "$(dirname "$0")/.."
