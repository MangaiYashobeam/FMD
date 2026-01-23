#!/bin/bash
# Seed AI memories script

# Login to get token
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST https://dealersface.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gadproductions.com","password":"Admin123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('accessToken',''))")

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "Token retrieved: ${TOKEN:0:30}..."

# Seed memories
echo "Seeding AI memories..."
SEED_RESPONSE=$(curl -s -X POST https://dealersface.com/api/ai-center/memories/seed \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Seed response: $SEED_RESPONSE"

# Get memories to verify
echo ""
echo "Verifying memories..."
curl -s https://dealersface.com/api/ai-center/memories \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Total memories: {d.get(\"data\",{}).get(\"count\",0)}')"
