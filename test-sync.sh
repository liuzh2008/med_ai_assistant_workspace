#!/bin/bash
echo '=== LOGIN ==='
TOKEN=$(curl -s -X POST http://localhost:9081/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"id":"doctor01","password":"correctPassword"}' 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "LOGIN FAILED"
  # Try raw output for debugging
  curl -s -X POST http://localhost:9081/api/users/login \
    -H 'Content-Type: application/json' \
    -d '{"id":"doctor01","password":"correctPassword"}'
  exit 1
fi
echo "Token obtained: ${TOKEN:0:30}..."

echo ''
echo '=== MANIFEST (before sync) ==='
curl -s http://localhost:9082/api/execute/templates/manifest \
  -H "Authorization: Bearer $TOKEN"

echo ''
echo '=== SYNC FROM GITHUB ==='
curl -s -X POST http://localhost:9082/api/execute/templates/sync \
  -H "Authorization: Bearer $TOKEN"

echo ''
echo '=== MANIFEST (after sync) ==='
curl -s http://localhost:9082/api/execute/templates/manifest \
  -H "Authorization: Bearer $TOKEN"

echo ''
echo '=== UPDATE FROM EXECUTION ==='
curl -s -X POST http://localhost:9081/api/hospital-config/templates/update \
  -H "Authorization: Bearer $TOKEN"

echo ''
echo '=== DONE ==='
