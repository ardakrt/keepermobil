#!/bin/bash
set -e

echo ""
echo "=========================================="
echo "DEBUG: google-services.json CHECK"
echo "=========================================="
echo ""

echo "1. Working directory: $(pwd)"
echo ""

echo "2. Finding all google-services.json files:"
find . -name "google-services.json" -type f 2>/dev/null | head -20
echo ""

echo "3. Root google-services.json:"
if [ -f "./google-services.json" ]; then
  echo "EXISTS - Content:"
  cat ./google-services.json
else
  echo "NOT FOUND!"
fi
echo ""

echo "4. android/app/google-services.json:"
if [ -f "./android/app/google-services.json" ]; then
  echo "EXISTS - Content:"
  cat ./android/app/google-services.json
else
  echo "NOT FOUND!"
fi
echo ""

echo "5. GOOGLE_SERVICES_JSON env var: $GOOGLE_SERVICES_JSON"
if [ -n "$GOOGLE_SERVICES_JSON" ] && [ -f "$GOOGLE_SERVICES_JSON" ]; then
  echo "ENV VAR points to file - Content:"
  cat "$GOOGLE_SERVICES_JSON"
fi
echo ""

echo "=========================================="
echo "END DEBUG"
echo "=========================================="
echo ""
