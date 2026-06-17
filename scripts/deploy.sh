#!/bin/bash

# ============================================================
# Bitlogic Client Hub — Deploy Script
# ============================================================
# Usage: ./scripts/deploy.sh [environment]
# Example:
#   ./scripts/deploy.sh production
#   ./scripts/deploy.sh staging
#
# This script:
# 1. Validates environment
# 2. Pulls latest code
# 3. Installs dependencies
# 4. Builds frontend
# 5. Runs migrations
# 6. Restarts backend with PM2
# ============================================================

set -e  # Exit on error

ENVIRONMENT=${1:-production}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ════════════════════════════════════════════════════════════
# Functions
# ════════════════════════════════════════════════════════════

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_environment() {
    if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
        log_error "Invalid environment: $ENVIRONMENT"
        echo "Usage: $0 [production|staging]"
        exit 1
    fi

    log_info "Deploying to: $ENVIRONMENT"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v node &> /dev/null; then
        log_error "Node.js not found"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        exit 1
    fi

    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 not found. Install with: npm install -g pm2"
        exit 1
    fi

    log_success "Prerequisites OK"
}

create_backup() {
    log_info "Creating pre-deploy backup..."

    BACKUP_DIR="/var/backups/bitlogic"
    mkdir -p "$BACKUP_DIR"

    # Backup current code
    tar -czf "$BACKUP_DIR/code_${TIMESTAMP}.tar.gz" \
        "$PROJECT_ROOT" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=dist \
        --exclude=.env.production \
        2>/dev/null || true

    # Backup database
    if command -v pg_dump &> /dev/null; then
        pg_dump -Fc bitlogic_prod > "$BACKUP_DIR/db_${TIMESTAMP}.dump" 2>/dev/null || true
    fi

    log_success "Backups created in $BACKUP_DIR"
}

pull_code() {
    log_info "Pulling latest code..."
    cd "$PROJECT_ROOT"

    if ! git pull origin main; then
        log_error "Failed to pull code. Check git status"
        exit 1
    fi

    log_success "Code updated"
}

install_dependencies() {
    log_info "Installing dependencies..."

    cd "$PROJECT_ROOT"
    npm install --omit=dev

    cd "$PROJECT_ROOT/backend"
    npm install --omit=dev

    log_success "Dependencies installed"
}

build_frontend() {
    log_info "Building frontend..."

    cd "$PROJECT_ROOT"
    npm run build

    if [ ! -d "$PROJECT_ROOT/dist" ]; then
        log_error "Build failed - dist directory not found"
        exit 1
    fi

    log_success "Frontend built"
}

run_migrations() {
    log_info "Running database migrations..."

    cd "$PROJECT_ROOT/backend"
    NODE_ENV=$ENVIRONMENT npm run migrate

    log_success "Migrations completed"
}

restart_backend() {
    log_info "Restarting backend with PM2..."

    cd "$PROJECT_ROOT"
    pm2 start ecosystem.config.js --env $ENVIRONMENT --update-env

    if ! pm2 status backend | grep -q online; then
        log_error "Backend failed to start"
        exit 1
    fi

    log_success "Backend restarted"
}

verify_deployment() {
    log_info "Verifying deployment..."

    sleep 3

    # Check backend health
    HEALTH_CHECK=$(curl -s http://localhost:3001/api/health)
    if echo "$HEALTH_CHECK" | grep -q "ok"; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        log_error "Response: $HEALTH_CHECK"
        exit 1
    fi
}

# ════════════════════════════════════════════════════════════
# Main Deployment Flow
# ════════════════════════════════════════════════════════════

main() {
    echo ""
    echo "╔════════════════════════════════════════════════════╗"
    echo "║  Bitlogic Client Hub — Deploy Script              ║"
    echo "║  Environment: $ENVIRONMENT"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""

    check_environment
    check_prerequisites
    create_backup
    pull_code
    install_dependencies
    build_frontend
    run_migrations
    restart_backend
    verify_deployment

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Deployment completed successfully!               ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Next steps:"
    echo "  • Check logs: pm2 logs backend"
    echo "  • Monitor: pm2 monit"
    echo "  • Test: curl https://api-clientes.bitlogic.com.ar/api/health"
    echo ""
}

main "$@"
