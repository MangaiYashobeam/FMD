#!/bin/bash
# ============================================
# DealersFace Production API Test Suite
# ============================================
# 
# Run this script on the VPS to test all API endpoints
# Usage: ./test-api.sh [base_url]
#
# ============================================

BASE_URL="${1:-http://localhost:3000}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================"
echo "  DealersFace API Test Suite"
echo "  Base URL: $BASE_URL"
echo "============================================"
echo ""

# Track results
PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local path="$3"
    local headers="$4"
    local data="$5"
    local expect_status="$6"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -H "Content-Type: application/json" $headers "$BASE_URL$path")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" $headers -d "$data" "$BASE_URL$path")
    fi
    
    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expect_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} - $name (HTTP $status_code)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} - $name (Expected $expect_status, got $status_code)"
        echo "  Response: $(echo "$body" | head -c 200)"
        ((FAILED++))
    fi
    
    # Return body for chaining
    echo "$body"
}

# ============================================
# 1. Health & Public Endpoints
# ============================================
echo ""
echo "=== 1. Health & Public Endpoints ==="

test_endpoint "Health Check" "GET" "/health" "" "" "200" > /dev/null

# ============================================
# 2. Authentication
# ============================================
echo ""
echo "=== 2. Authentication ==="

LOGIN_RESPONSE=$(test_endpoint "Login - Super Admin" "POST" "/api/auth/login" "" '{"email":"admin@gadproductions.com","password":"GadAdmin2026!Temp"}' "200")

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ CRITICAL${NC} - Could not extract auth token. Stopping tests."
    echo "Login response: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓${NC} Token extracted successfully"
AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""

# ============================================
# 3. Account Endpoints
# ============================================
echo ""
echo "=== 3. Account Endpoints ==="

test_endpoint "Get Current Account" "GET" "/api/accounts/current" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# 4. Vehicle/Inventory Endpoints
# ============================================
echo ""
echo "=== 4. Vehicle/Inventory Endpoints ==="

test_endpoint "List Vehicles" "GET" "/api/vehicles" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# 5. Facebook Integration
# ============================================
echo ""
echo "=== 5. Facebook Integration ==="

test_endpoint "Facebook Auth URL" "GET" "/api/facebook/auth-url" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null
test_endpoint "Facebook Status" "GET" "/api/facebook/status" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# 6. Leads Endpoints
# ============================================
echo ""
echo "=== 6. Leads Endpoints ==="

test_endpoint "List Leads" "GET" "/api/leads" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# 7. Admin Endpoints
# ============================================
echo ""
echo "=== 7. Admin Endpoints ==="

test_endpoint "System Status" "GET" "/api/admin/system/status" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null
test_endpoint "List Users (Admin)" "GET" "/api/admin/users" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# 8. AI Center Endpoints
# ============================================
echo ""
echo "=== 8. AI Center Endpoints ==="

test_endpoint "AI Providers" "GET" "/api/ai-center/providers" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null
test_endpoint "AI Dashboard" "GET" "/api/ai-center/dashboard" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# 9. Extension Endpoints
# ============================================
echo ""
echo "=== 9. Extension Endpoints ==="

test_endpoint "Extension Status" "GET" "/api/extension/status" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# 10. Worker/Posting Endpoints  
# ============================================
echo ""
echo "=== 10. Worker Endpoints ==="

test_endpoint "Worker Status" "GET" "/api/workers/status" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null
test_endpoint "Posting Queue" "GET" "/api/posting/queue" "-H \"Authorization: Bearer $TOKEN\"" "" "200" > /dev/null

# ============================================
# Results Summary
# ============================================
echo ""
echo "============================================"
echo "  Test Results Summary"
echo "============================================"
TOTAL=$((PASSED + FAILED))
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo "  Total:  $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${YELLOW}Some tests failed. Check the output above.${NC}"
    exit 1
fi
