#!/bin/sh
# Cross-AZ: Traffic Slowdown REUSES the shared AZ-slowdown FIS role
# (fis-az-app-slowdown-role) — the two AZ-slowdown labs need identical FIS
# permissions, and that role is already mapped into the PetSite EKS cluster's
# aws-auth by the CDK, so it authorizes ECS + EKS + EC2 actions for both labs.
# This script just ensures the shared role exists (idempotent) by delegating to
# the az-app-slowdown setup script.
ROLE=fis-az-app-slowdown-role
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSHOP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHARED_SETUP="$WORKSHOP_DIR/az-app-slowdown-experiment/scripts/setup_az_app_slowdown_fasttrack.sh"

if aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "Shared role $ROLE already exists — nothing to do for Cross-AZ: Traffic Slowdown (it reuses this role)."
  exit 0
fi

if [ -f "$SHARED_SETUP" ]; then
  echo "Shared role $ROLE not found — creating it via the AZ: Application Slowdown setup script..."
  sh "$SHARED_SETUP" || { echo "ERROR: shared role setup failed. See the message above." >&2; exit 1; }
else
  echo "ERROR: could not find the shared setup script at $SHARED_SETUP." >&2
  echo "Run the AZ: Application Slowdown lab's setup (sh az-app-slowdown-experiment/scripts/setup_az_app_slowdown_fasttrack.sh) to create $ROLE, then retry." >&2
  exit 1
fi
