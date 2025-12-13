#!/bin/bash

echo "=== DEBUG: Checking google-services.json ==="
echo ""
echo "1. Current directory:"
pwd
echo ""
echo "2. Looking for google-services.json files:"
find . -name "google-services.json" 2>/dev/null
echo ""
echo "3. Content of android/app/google-services.json (if exists):"
if [ -f "./android/app/google-services.json" ]; then
  cat ./android/app/google-services.json
else
  echo "File not found!"
fi
echo ""
echo "4. GOOGLE_SERVICES_JSON env var:"
echo "$GOOGLE_SERVICES_JSON"
echo ""
echo "5. Content of GOOGLE_SERVICES_JSON file (if env var points to a file):"
if [ -n "$GOOGLE_SERVICES_JSON" ] && [ -f "$GOOGLE_SERVICES_JSON" ]; then
  cat "$GOOGLE_SERVICES_JSON"
else
  echo "Env var is empty or not a file path"
fi
echo ""
echo "6. Root google-services.json (if exists):"
if [ -f "./google-services.json" ]; then
  cat ./google-services.json
else
  echo "Root google-services.json not found!"
fi
echo ""
echo "=== END DEBUG ==="
