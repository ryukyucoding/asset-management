#!/usr/bin/env bash
# Local k6 credentials (matches prisma seed). Override for production runs.
export USER_EMAIL="${USER_EMAIL:-user@example.com}"
export USER_PASSWORD="${USER_PASSWORD:-User1234}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin1234}"
