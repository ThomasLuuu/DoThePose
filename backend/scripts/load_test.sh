#!/bin/bash
# Quick load test: upload N concurrent images and measure response time
# Usage: ./scripts/load_test.sh [concurrent_count] [image_path]

set -e

CONCURRENT=${1:-3}
IMAGE=${2:-""}
API_URL="${API_URL:-http://localhost:3000}"

if [ -z "$IMAGE" ]; then
  # Create a test image using Node/sharp if none provided
  echo "Creating test image..."
  node -e "
    const sharp = require('sharp');
    sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 128, g: 100, b: 80 } }
    }).jpeg().toFile('/tmp/pose_test.jpg').then(() => console.log('Test image created'));
  "
  IMAGE="/tmp/pose_test.jpg"
fi

echo "=== Pose Guide Load Test ==="
echo "Concurrent uploads: $CONCURRENT"
echo "Image: $IMAGE"
echo "API: $API_URL"
echo ""

now_ms() {
  python3 -c 'import time; print(int(time.time()*1000))'
}

upload_and_track() {
  local id=$1
  local start=$(now_ms)

  echo "[$id] Uploading..."
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$API_URL/api/guides" \
    -F "image=@$IMAGE" 2>&1)

  local end=$(now_ms)
  local elapsed=$((end - start))

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "201" ]; then
    GUIDE_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "unknown")
    echo "[$id] Upload OK in ${elapsed}ms (guide: $GUIDE_ID)"

    local poll_start=$(now_ms)
    local status="processing"
    while [ "$status" != "completed" ] && [ "$status" != "failed" ]; do
      sleep 2
      local poll_elapsed=$(( $(now_ms) - poll_start ))
      if [ "$poll_elapsed" -gt 120000 ]; then
        echo "[$id] TIMEOUT after ${poll_elapsed}ms polling"
        return 1
      fi
      status=$(curl -s "$API_URL/api/guides/$GUIDE_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null || echo "error")
    done

    local total_elapsed=$(( $(now_ms) - start ))
    echo "[$id] Final status: $status, total time: ${total_elapsed}ms"
  else
    echo "[$id] Upload FAILED (HTTP $HTTP_CODE) in ${elapsed}ms"
  fi
}

PIDS=()
for i in $(seq 1 $CONCURRENT); do
  upload_and_track $i &
  PIDS+=($!)
done

echo "Waiting for all $CONCURRENT uploads to complete..."
FAILURES=0
for pid in "${PIDS[@]}"; do
  if ! wait $pid; then
    FAILURES=$((FAILURES + 1))
  fi
done

echo ""
echo "=== Results ==="
echo "Total: $CONCURRENT, Failures: $FAILURES"
