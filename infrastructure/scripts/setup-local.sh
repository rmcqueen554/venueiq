#!/bin/bash
set -e

echo "🏟️  VenueIQ — Local Development Setup"
echo "======================================="

# Check prerequisites
command -v node   >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required"; exit 1; }
command -v npm    >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }

echo "✓ Prerequisites met"

# Copy env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ .env created from .env.example — fill in your API keys"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start infrastructure
echo "🐳 Starting Docker infrastructure..."
docker-compose up -d

# Wait for Postgres
echo "⏳ Waiting for databases to be ready..."
for port in 5432 5433 5434 5435 5436 5437 5438 5439 5440 5441 5442 5443 5444 5445 5446; do
  until nc -z localhost $port 2>/dev/null; do sleep 1; done
done
echo "✓ All databases ready"

# Run Prisma migrations
echo "🗄️  Running database migrations..."
npm run db:generate
npm run db:migrate

# Create Kafka topics
echo "📨 Creating Kafka topics..."
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.pos.transactions --partitions 12 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.security.gate_scans --partitions 6 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.parking.entries --partitions 6 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.security.incidents --partitions 3 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.facilities.iot_readings --partitions 6 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.agents.outputs --partitions 3 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.analytics.kpi_snapshots --partitions 6 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.automation.triggers --partitions 3 --replication-factor 1
docker-compose exec kafka kafka-topics --bootstrap-server localhost:9092 --create --if-not-exists \
  --topic venueiq.notifications.requests --partitions 3 --replication-factor 1

echo "✓ Kafka topics created"

echo ""
echo "🎉 VenueIQ local dev environment ready!"
echo ""
echo "  Frontend:       http://localhost:5173"
echo "  Kafka UI:       http://localhost:8080"
echo "  Elasticsearch:  http://localhost:9200"
echo ""
echo "Next steps:"
echo "  1. Fill in API keys in .env (Clerk, Anthropic, Stripe, etc.)"
echo "  2. Run: npm run dev"
