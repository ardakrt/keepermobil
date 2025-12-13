#!/bin/bash
set -e

echo "=== DEBUG: google-services.json check ==="

# 1. Check root directory
echo "1. Root google-services.json exists?"
ls -la ./google-services.json 2>/dev/null || echo "NOT FOUND in root"

# 2. Check android/app
echo ""
echo "2. android/app/google-services.json exists?"
ls -la ./android/app/google-services.json 2>/dev/null || echo "NOT FOUND in android/app"

# 3. Show content
echo ""
echo "3. Content of android/app/google-services.json:"
cat ./android/app/google-services.json 2>/dev/null || echo "Could not read file"

echo ""
echo "=== END DEBUG ==="
