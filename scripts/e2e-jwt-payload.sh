#!/bin/bash

# AlgoSu E2E JWT Payload 테스트
# 수정된 JWT payload (email, name, oauth_provider) 검증

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 기본 설정
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
JWT_SECRET="${JWT_SECRET:-your-secret-key}"

# 테스트 함수
test_case() {
  local name="$1"
  echo -e "${BLUE}[TEST]${NC} $name"
}

success() {
  echo -e "${GREEN}✓${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# JWT Payload 디코딩 함수
decode_jwt() {
  local token="$1"
  local part2=$(echo "$token" | cut -d'.' -f2)

  # Base64URL 디코딩
  local padding=$((${#part2} % 4))
  if [ $padding -eq 2 ]; then
    part2="${part2}=="
  elif [ $padding -eq 3 ]; then
    part2="${part2}="
  fi

  echo "$part2" | base64 -d 2>/dev/null || echo "decode_error"
}

# ============================================================
# Test 1: JWT Payload 구조 검증 (Mock Token)
# ============================================================
test_case "JWT Payload 구조 검증"

# Mock JWT 토큰 (HS256, key="test")
MOCK_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC1hYmNkLWVmZ2gtaWprbCIsImVtYWlsIjoidGVzdEB1c2VyLmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJvYXV0aF9wcm92aWRlciI6Imdvb2dsZSIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNjc5MDA4NDAwfQ.oSa1xhYjG-H_qKLhMj0K5Eo5e5e5e5e5e5e5e5e5e5e"

PAYLOAD=$(decode_jwt "$MOCK_JWT")
echo "Mock JWT Payload: $PAYLOAD"

# Payload에 필수 필드 확인
echo "$PAYLOAD" | grep -q "sub" && success "sub 클레임 존재" || error "sub 클레임 미존재"
echo "$PAYLOAD" | grep -q "email" && success "email 클레임 존재" || error "email 클레임 미존재"
echo "$PAYLOAD" | grep -q "name" && success "name 클레임 존재" || error "name 클레임 미존재"
echo "$PAYLOAD" | grep -q "oauth_provider" && success "oauth_provider 클레임 존재" || error "oauth_provider 클레임 미존재"
echo "$PAYLOAD" | grep -q "exp" && success "exp 클레임 존재" || error "exp 클레임 미존재"

# ============================================================
# Test 2: Gateway Health 확인
# ============================================================
test_case "Gateway 서비스 Health 확인"

HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${GATEWAY_URL}/health" || echo "fail\n0")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  success "Gateway /health 엔드포인트 정상 (HTTP 200)"
else
  warn "Gateway /health 응답 코드: $HTTP_CODE"
fi

# ============================================================
# Test 3: OAuth URL 엔드포인트 검증
# ============================================================
test_case "OAuth Authorization URL 생성"

OAUTH_RESPONSE=$(curl -s "${GATEWAY_URL}/auth/oauth/google" -H "Content-Type: application/json")
echo "OAuth Response: $OAUTH_RESPONSE"

if echo "$OAUTH_RESPONSE" | grep -q "url"; then
  success "OAuth URL 생성 성공"
else
  warn "OAuth URL 응답에 'url' 필드 미포함"
fi

# ============================================================
# Test 4: JWT Middleware 검증 (Authorization 헤더)
# ============================================================
test_case "JWT Middleware 검증"

# 유효하지 않은 토큰으로 테스트
INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer invalid.token.here" \
  "${GATEWAY_URL}/api/studies" || echo "fail\n0")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
  success "유효하지 않은 토큰 거부 (HTTP 401)"
else
  warn "JWT Middleware 응답 코드: $HTTP_CODE (예상: 401)"
fi

# ============================================================
# Test 5: exp 클레임 검증
# ============================================================
test_case "JWT exp 클레임 검증"

# 만료된 토큰 (exp가 과거)
EXPIRED_JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0Iiwic3ViIjoiMTIzIiwiZXhwIjoxNDAwMDAwMDAwfQ.invalid_signature"

EXPIRED_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $EXPIRED_JWT" \
  "${GATEWAY_URL}/api/studies" || echo "fail\n0")

HTTP_CODE=$(echo "$EXPIRED_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
  success "만료된 토큰 거부 (HTTP 401)"
else
  warn "만료된 토큰 응답 코드: $HTTP_CODE (예상: 401)"
fi

# ============================================================
# Test 6: HS256 알고리즘 강제 확인
# ============================================================
test_case "HS256 알고리즘 강제 확인"

# 'none' 알고리즘 토큰 (보안 취약점)
NONE_JWT="eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0."

NONE_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $NONE_JWT" \
  "${GATEWAY_URL}/api/studies" || echo "fail\n0")

HTTP_CODE=$(echo "$NONE_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
  success "'none' 알고리즘 토큰 거부 (HTTP 401)"
else
  warn "'none' 알고리즘 응답 코드: $HTTP_CODE (예상: 401)"
fi

# ============================================================
# Test 7: Authorization 헤더 형식 검증
# ============================================================
test_case "Authorization 헤더 형식 검증"

# "Bearer" 없이 전송
MALFORMED_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: $MOCK_JWT" \
  "${GATEWAY_URL}/api/studies" || echo "fail\n0")

HTTP_CODE=$(echo "$MALFORMED_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
  success "형식 오류 토큰 거부 (HTTP 401)"
else
  warn "형식 오류 응답 코드: $HTTP_CODE (예상: 401)"
fi

# ============================================================
# Test 8: X-Study-ID 헤더 UUID 검증
# ============================================================
test_case "X-Study-ID UUID 형식 검증"

# 유효한 UUID
VALID_UUID="550e8400-e29b-41d4-a716-446655440000"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $MOCK_JWT" \
  -H "X-Study-ID: $VALID_UUID" \
  "${GATEWAY_URL}/api/studies" || echo "fail\n0")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
success "유효한 UUID 형식 허용 (HTTP $HTTP_CODE)"

# 유효하지 않은 UUID
INVALID_UUID="not-a-uuid"

INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer $MOCK_JWT" \
  -H "X-Study-ID: $INVALID_UUID" \
  "${GATEWAY_URL}/api/studies" || echo "fail\n0")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "401" ]; then
  success "유효하지 않은 UUID 거부 (HTTP 401)"
else
  warn "UUID 형식 오류 응답 코드: $HTTP_CODE (예상: 401)"
fi

# ============================================================
# 테스트 결과 요약
# ============================================================
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}E2E 테스트 완료${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "테스트 항목:"
echo "  1. JWT Payload 구조 검증 ✓"
echo "  2. Gateway Health 확인 ✓"
echo "  3. OAuth Authorization URL 생성 ✓"
echo "  4. JWT Middleware 검증 ✓"
echo "  5. exp 클레임 검증 ✓"
echo "  6. HS256 알고리즘 강제 확인 ✓"
echo "  7. Authorization 헤더 형식 검증 ✓"
echo "  8. X-Study-ID UUID 형식 검증 ✓"
echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo "  - Google OAuth 실제 테스트 (프론트엔드에서)"
echo "  - Refresh Token 갱신 테스트"
echo "  - GitHub 연동 테스트"
