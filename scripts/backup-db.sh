#!/bin/bash

# ============================================================
# Bitlogic — PostgreSQL Backup Script
# ============================================================
# Usage: ./scripts/backup-db.sh [backup_type]
# Example:
#   ./scripts/backup-db.sh daily    # Compressed dump
#   ./scripts/backup-db.sh weekly   # Custom format
#   ./scripts/backup-db.sh           # Default (daily)
#
# Automatic setup (cron):
# Add to /etc/cron.d/bitlogic:
#   0 2 * * * postgres /home/deploy/bitlogic-client-hub/scripts/backup-db.sh >> /var/log/bitlogic-backup.log 2>&1
#
# This script:
# 1. Creates PostgreSQL backup (Fc format - compressed, custom)
# 2. Verifies backup integrity
# 3. Uploads to AWS S3 (optional)
# 4. Cleans up old backups (>30 days)
# ============================================================

set -e

BACKUP_TYPE=${1:-daily}
BACKUP_DIR="/var/backups/bitlogic"
BACKUP_DATE=$(date +%Y%m%d)
BACKUP_TIME=$(date +%H%M%S)
BACKUP_TIMESTAMP="${BACKUP_DATE}_${BACKUP_TIME}"
BACKUP_FILE="${BACKUP_DIR}/bitlogic_prod_${BACKUP_TIMESTAMP}.dump"
DATABASE_NAME="bitlogic_prod"
DATABASE_USER="bitlogic_user"
RETENTION_DAYS=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} [INFO] $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} [SUCCESS] $1"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} [ERROR] $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} [WARN] $1"
}

# ════════════════════════════════════════════════════════════
# 1. Prepare backup directory
# ════════════════════════════════════════════════════════════

log_info "Starting PostgreSQL backup ($BACKUP_TYPE)"

if [ ! -d "$BACKUP_DIR" ]; then
    log_info "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"
fi

# ════════════════════════════════════════════════════════════
# 2. Create database backup
# ════════════════════════════════════════════════════════════

log_info "Creating backup of database: $DATABASE_NAME"
log_info "Output: $BACKUP_FILE"

if ! pg_dump \
    -Fc \
    --username="$DATABASE_USER" \
    --dbname="$DATABASE_NAME" \
    --compress=9 \
    --verbose \
    > "$BACKUP_FILE" 2>&1; then
    log_error "Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log_success "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# ════════════════════════════════════════════════════════════
# 3. Verify backup integrity
# ════════════════════════════════════════════════════════════

log_info "Verifying backup integrity..."

if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
    log_success "Backup verification passed"
else
    log_error "Backup verification failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# ════════════════════════════════════════════════════════════
# 4. Upload to AWS S3 (optional)
# ════════════════════════════════════════════════════════════

if command -v aws &> /dev/null && [ ! -z "$AWS_S3_BUCKET" ]; then
    log_info "Uploading to S3: s3://$AWS_S3_BUCKET/backups/$BACKUP_FILE"

    if aws s3 cp "$BACKUP_FILE" "s3://$AWS_S3_BUCKET/backups/$(basename $BACKUP_FILE)" \
        --sse AES256 \
        --storage-class STANDARD_IA; then
        log_success "S3 upload completed"
    else
        log_warn "S3 upload failed (backup still local)"
    fi
else
    log_warn "AWS CLI or AWS_S3_BUCKET not configured, skipping S3 upload"
fi

# ════════════════════════════════════════════════════════════
# 5. Clean up old backups
# ════════════════════════════════════════════════════════════

log_info "Cleaning up backups older than $RETENTION_DAYS days..."

OLD_BACKUPS=$(find "$BACKUP_DIR" -name "bitlogic_prod_*.dump" -mtime +$RETENTION_DAYS)

if [ -z "$OLD_BACKUPS" ]; then
    log_info "No old backups to remove"
else
    echo "$OLD_BACKUPS" | while read backup; do
        log_info "Removing old backup: $(basename $backup)"
        rm -f "$backup"
    done
    log_success "Cleanup completed"
fi

# ════════════════════════════════════════════════════════════
# 6. Summary
# ════════════════════════════════════════════════════════════

TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "bitlogic_prod_*.dump" 2>/dev/null | wc -l)

echo ""
log_success "Backup completed successfully!"
echo ""
echo "  Type: $BACKUP_TYPE"
echo "  File: $BACKUP_FILE"
echo "  Size: $BACKUP_SIZE"
echo "  Total backups: $BACKUP_COUNT"
echo "  Total storage: $TOTAL_SIZE"
echo ""
echo "Restore command:"
echo "  pg_restore -Fc -d bitlogic_prod $BACKUP_FILE"
echo ""
