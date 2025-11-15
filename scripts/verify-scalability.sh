#!/bin/bash

# Scalability Verification Script
# Checks that all scalability components are properly configured

set -e

echo "🔍 UWG Engine - Scalability Verification"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2 (missing: $1)"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2 (missing: $1)"
        return 1
    fi
}

# Track failures
FAILED=0

echo "📦 Checking Core Files..."
check_file "packages/storage/src/redis-cache.ts" "Redis Cache" || ((FAILED++))
check_file "packages/storage/src/postgres-storage.ts" "PostgreSQL Storage" || ((FAILED++))
check_file "packages/storage/src/storage-factory.ts" "Storage Factory" || ((FAILED++))
check_file "packages/engine/src/job-queue.ts" "Job Queue" || ((FAILED++))
check_file "packages/engine/src/worker-pool.ts" "Worker Pool" || ((FAILED++))
check_file "packages/engine/src/worker-entry.ts" "Worker Entry Point" || ((FAILED++))
check_file "packages/connectors/src/connection-pool.ts" "Connection Pool" || ((FAILED++))
check_file "packages/api/src/middleware/distributed-rate-limiter.ts" "Distributed Rate Limiter" || ((FAILED++))
check_file "packages/api/src/middleware/metrics.ts" "Prometheus Metrics" || ((FAILED++))
echo ""

echo "🐳 Checking Docker Files..."
check_file "docker-compose.production.yml" "Production Docker Compose" || ((FAILED++))
check_file "Dockerfile.worker" "Worker Dockerfile" || ((FAILED++))
check_file "nginx.production.conf" "Nginx Config" || ((FAILED++))
check_file "prometheus.yml" "Prometheus Config" || ((FAILED++))
echo ""

echo "📊 Checking Monitoring Files..."
check_dir "grafana" "Grafana Directory" || ((FAILED++))
check_file "grafana/datasources/prometheus.yml" "Grafana Datasource" || ((FAILED++))
check_file "grafana/dashboards/uwg-engine.json" "Grafana Dashboard" || ((FAILED++))
check_file "grafana/dashboards/dashboards.yml" "Dashboard Provisioning" || ((FAILED++))
echo ""

echo "📚 Checking Documentation..."
check_file "docs/scalability.md" "Scalability Guide" || ((FAILED++))
check_file "SCALABILITY_SUMMARY.md" "Scalability Summary" || ((FAILED++))
check_file ".env.example" "Environment Example" || ((FAILED++))
echo ""

echo "💡 Checking Examples..."
check_file "examples/production-setup.ts" "Production Setup Example" || ((FAILED++))
check_file "examples/quickstart-scalable.ts" "Quickstart Example" || ((FAILED++))
check_file "examples/README.md" "Examples README" || ((FAILED++))
echo ""

echo "🧪 Checking Tests..."
check_file "packages/engine/src/__tests__/scalability.test.ts" "Scalability Tests" || ((FAILED++))
echo ""

# Check package.json dependencies
echo "📦 Checking Dependencies..."
if grep -q "bullmq" packages/engine/package.json; then
    echo -e "${GREEN}✓${NC} BullMQ dependency"
else
    echo -e "${RED}✗${NC} BullMQ dependency missing"
    ((FAILED++))
fi

if grep -q "ioredis" packages/engine/package.json; then
    echo -e "${GREEN}✓${NC} IORedis dependency"
else
    echo -e "${RED}✗${NC} IORedis dependency missing"
    ((FAILED++))
fi

if grep -q "\"pg\"" packages/storage/package.json; then
    echo -e "${GREEN}✓${NC} PostgreSQL dependency"
else
    echo -e "${RED}✗${NC} PostgreSQL dependency missing"
    ((FAILED++))
fi

if grep -q "prom-client" packages/api/package.json; then
    echo -e "${GREEN}✓${NC} Prometheus client dependency"
else
    echo -e "${RED}✗${NC} Prometheus client dependency missing"
    ((FAILED++))
fi

if grep -q "rate-limiter-flexible" packages/api/package.json; then
    echo -e "${GREEN}✓${NC} Rate limiter dependency"
else
    echo -e "${RED}✗${NC} Rate limiter dependency missing"
    ((FAILED++))
fi

echo ""
echo "========================================"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All scalability components verified successfully!${NC}"
    echo ""
    echo "🚀 Ready for production deployment:"
    echo "   docker-compose -f docker-compose.production.yml up -d"
    exit 0
else
    echo -e "${RED}❌ Verification failed with $FAILED errors${NC}"
    echo ""
    echo "Please ensure all files are present and dependencies are installed."
    exit 1
fi
