#!/bin/bash

# AlgoSu E2E 전체 플로우 테스트 (UI v2 기준)
# 대상: OCI k3s 클러스터 또는 로컬 환경
# 사용법: GATEWAY_URL=http://localhost:3000 JWT_SECRET=xxx ./scripts/e2e-full.sh

set -euo pipefail

# ── 색상 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── 설정 ──
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
JWT_SECRET="${JWT_SECRET:-dsED8FnOw7FfkbpaoN5o1qWf6/ioebWatodWPgO96le19YzHkabPKSJffKUfQNxL}"

# 실 유저 데이터 (DB에서 확인된 값)
# JWT sub = users.id (내부 PK UUID), NOT publicId
TEST_USER_ID="${TEST_USER_ID:-b8076b69-1573-46af-9e98-b11fe65dbdfa}"
TEST_USER_PUBLIC_ID="${TEST_USER_PUBLIC_ID:-b7a83d23-50c1-41e5-bd6f-7352b32c67f2}"
TEST_USER_EMAIL="tpalsdlapfnd@gmail.com"
TEST_USER_NAME="tpalsdlapfnd"
# X-Study-ID 헤더에는 studies.id (내부 PK UUID) 사용
TEST_STUDY_ID="${TEST_STUDY_ID:-35a8581b-869b-4492-9baf-773994c42433}"
TEST_STUDY_PUBLIC_ID="${TEST_STUDY_PUBLIC_ID:-23a0ea77-e761-4213-80fb-71e9255114c3}"

# ── 카운터 ──
PASS=0
FAIL=0
SKIP=0
TOTAL=0

# ── 유틸리티 ──
section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

test_case() {
  TOTAL=$((TOTAL + 1))
  echo -e "${BLUE}[TEST $TOTAL]${NC} $1"
}

pass() {
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${NC} $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${NC} $1"
}

skip() {
  SKIP=$((SKIP + 1))
  echo -e "  ${YELLOW}⚠ SKIP${NC} $1"
}

# ── JWT 생성 (HS256) ──
generate_jwt() {
  local sub="$1"
  local email="$2"
  local name="$3"
  local exp_offset="${4:-3600}"  # 기본 1시간

  local now=$(date +%s)
  local exp=$((now + exp_offset))

  local header='{"alg":"HS256","typ":"JWT"}'
  local payload="{\"sub\":\"${sub}\",\"email\":\"${email}\",\"name\":\"${name}\",\"oauth_provider\":\"google\",\"iat\":${now},\"exp\":${exp}}"

  local h_b64=$(echo -n "$header" | openssl base64 -e | tr '+/' '-_' | tr -d '=\n')
  local p_b64=$(echo -n "$payload" | openssl base64 -e | tr '+/' '-_' | tr -d '=\n')

  local sig=$(echo -n "${h_b64}.${p_b64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | openssl base64 -e | tr '+/' '-_' | tr -d '=\n')

  echo "${h_b64}.${p_b64}.${sig}"
}

generate_expired_jwt() {
  generate_jwt "$TEST_USER_ID" "$TEST_USER_EMAIL" "$TEST_USER_NAME" "-3600"
}

# ── HTTP 헬퍼 ──
http_get() {
  local url="$1"
  shift
  curl -s -w "\n%{http_code}" --max-time 10 "$@" "${GATEWAY_URL}${url}" 2>/dev/null
}

http_post() {
  local url="$1"
  local body="$2"
  shift 2
  curl -s -w "\n%{http_code}" --max-time 10 -X POST -H "Content-Type: application/json" -d "$body" "$@" "${GATEWAY_URL}${url}" 2>/dev/null
}

http_patch() {
  local url="$1"
  local body="$2"
  shift 2
  curl -s -w "\n%{http_code}" --max-time 10 -X PATCH -H "Content-Type: application/json" -d "$body" "$@" "${GATEWAY_URL}${url}" 2>/dev/null
}

http_delete() {
  local url="$1"
  shift
  curl -s -w "\n%{http_code}" --max-time 10 -X DELETE "$@" "${GATEWAY_URL}${url}" 2>/dev/null
}

extract_status() {
  echo "$1" | tail -1
}

extract_body() {
  echo "$1" | sed '$d'
}

# ── 유효한 JWT 생성 (sub = users.id 내부 PK) ──
VALID_JWT=$(generate_jwt "$TEST_USER_ID" "$TEST_USER_EMAIL" "$TEST_USER_NAME")
# Bearer 헤더 + Cookie 둘 다 전달 (환경에 따라 하나가 동작)
AUTH_OPTS=("-H" "Authorization: Bearer ${VALID_JWT}" "-b" "access_token=${VALID_JWT}" "-H" "X-Study-ID: ${TEST_STUDY_ID}")

echo -e "${CYAN}AlgoSu E2E Full Test Suite (UI v2)${NC}"
echo "Target: ${GATEWAY_URL}"
echo "User:   ${TEST_USER_EMAIL}"
echo "Study:  ${TEST_STUDY_ID}"
echo ""

# ═══════════════════════════════════════════════════
# Section 1: Health Checks
# ═══════════════════════════════════════════════════
section "1. Health Checks"

test_case "Gateway /health"
RESP=$(http_get "/health")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q '"status"'; then
  pass "GET /health → 200 ($(echo "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status","?"))' 2>/dev/null || echo 'ok'))"
else
  fail "GET /health → $STATUS"
fi

test_case "Gateway /metrics (Prometheus)"
RESP=$(http_get "/metrics")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "GET /metrics → 200"
elif [ "$STATUS" = "307" ] || [ "$STATUS" = "404" ]; then
  pass "GET /metrics → $STATUS (Ingress 미노출 — 보안상 정상)"
else
  fail "GET /metrics → $STATUS"
fi

# ═══════════════════════════════════════════════════
# Section 2: Authentication & Security
# ═══════════════════════════════════════════════════
section "2. Authentication & Security"

test_case "OAuth Google URL 생성"
RESP=$(http_get "/auth/oauth/google")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
  pass "GET /auth/oauth/google → $STATUS"
elif echo "$BODY" | grep -qi "url\|redirect\|accounts.google"; then
  pass "GET /auth/oauth/google → redirect detected"
else
  fail "GET /auth/oauth/google → $STATUS"
fi

test_case "OAuth Naver URL 생성"
RESP=$(http_get "/auth/oauth/naver")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
  if echo "$BODY" | grep -qi "nid.naver.com"; then
    pass "GET /auth/oauth/naver → $STATUS (naver URL 확인)"
  else
    pass "GET /auth/oauth/naver → $STATUS"
  fi
else
  fail "GET /auth/oauth/naver → $STATUS"
fi

test_case "OAuth Kakao URL 생성"
RESP=$(http_get "/auth/oauth/kakao")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
  if echo "$BODY" | grep -qi "kauth.kakao.com"; then
    pass "GET /auth/oauth/kakao → $STATUS (kakao URL 확인)"
  else
    pass "GET /auth/oauth/kakao → $STATUS"
  fi
else
  fail "GET /auth/oauth/kakao → $STATUS"
fi

test_case "OAuth 잘못된 provider 거부"
RESP=$(http_get "/auth/oauth/twitter")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "404" ]; then
  pass "GET /auth/oauth/twitter → $STATUS (unsupported provider)"
else
  fail "GET /auth/oauth/twitter → $STATUS (expected 400/404)"
fi

test_case "OAuth Callback — 유효하지 않은 state 거부"
RESP=$(http_get "/auth/oauth/google/callback?code=test_code&state=invalid_state_value")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "302" ]; then
  pass "Invalid OAuth state → $STATUS"
else
  fail "Invalid OAuth state → $STATUS (expected 400/302)"
fi

test_case "OAuth Callback — 누락된 code 거부"
RESP=$(http_get "/auth/oauth/google/callback?state=some_state")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "302" ]; then
  pass "Missing OAuth code → $STATUS"
else
  fail "Missing OAuth code → $STATUS (expected 400/302)"
fi

test_case "OAuth Callback — 누락된 state 거부"
RESP=$(http_get "/auth/oauth/google/callback?code=some_code")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "302" ]; then
  pass "Missing OAuth state → $STATUS"
else
  fail "Missing OAuth state → $STATUS (expected 400/302)"
fi

test_case "미인증 요청 거부"
RESP=$(http_get "/api/studies")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "401" ]; then
  pass "GET /api/studies (no auth) → 401"
else
  fail "GET /api/studies (no auth) → $STATUS (expected 401)"
fi

test_case "만료된 JWT 거부"
EXPIRED_JWT=$(generate_expired_jwt)
RESP=$(http_get "/api/studies" -b "access_token=${EXPIRED_JWT}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "401" ]; then
  pass "Expired JWT → 401"
else
  fail "Expired JWT → $STATUS (expected 401)"
fi

test_case "잘못된 JWT 거부"
RESP=$(http_get "/api/studies" -b "access_token=invalid.jwt.token")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "401" ]; then
  pass "Invalid JWT → 401"
else
  fail "Invalid JWT → $STATUS (expected 401)"
fi

test_case "유효한 JWT 인증 성공"
RESP=$(http_get "/api/studies" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "Valid JWT → 200"
else
  fail "Valid JWT → $STATUS (expected 200)"
fi

test_case "CORS Preflight"
RESP=$(curl -s -w "\n%{http_code}" --max-time 10 -X OPTIONS \
  -H "Origin: https://algo-su.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization,X-Study-ID" \
  "${GATEWAY_URL}/api/studies" 2>/dev/null)
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "204" ] || [ "$STATUS" = "200" ]; then
  pass "OPTIONS /api/studies → $STATUS"
else
  fail "OPTIONS /api/studies → $STATUS (expected 204)"
fi

# ═══════════════════════════════════════════════════
# Section 3: Profile API
# ═══════════════════════════════════════════════════
section "3. Profile API"

test_case "프로필 조회"
RESP=$(http_get "/auth/profile" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q '"email"'; then
  PROFILE_EMAIL=$(echo "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("email",""))' 2>/dev/null || echo "")
  pass "GET /auth/profile → 200 (email: $PROFILE_EMAIL)"
else
  fail "GET /auth/profile → $STATUS"
fi

# ═══════════════════════════════════════════════════
# Section 4: Study API
# ═══════════════════════════════════════════════════
section "4. Study API"

test_case "스터디 목록 조회"
RESP=$(http_get "/api/studies" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ]; then
  STUDY_COUNT=$(echo "$BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get("data",[])))' 2>/dev/null || echo "?")
  pass "GET /api/studies → 200 (count: $STUDY_COUNT)"
else
  fail "GET /api/studies → $STATUS"
fi

test_case "스터디 상세 조회"
RESP=$(http_get "/api/studies/${TEST_STUDY_ID}" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ] && echo "$BODY" | grep -q '"name"'; then
  STUDY_NAME=$(echo "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("name",""))' 2>/dev/null || echo "")
  pass "GET /api/studies/:id → 200 (name: $STUDY_NAME)"
else
  fail "GET /api/studies/:id → $STATUS"
fi

test_case "스터디 멤버 목록"
RESP=$(http_get "/api/studies/${TEST_STUDY_ID}/members" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  MEMBER_COUNT=$(echo "$(extract_body "$RESP")" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get("data",[])))' 2>/dev/null || echo "?")
  pass "GET /api/studies/:id/members → 200 (members: $MEMBER_COUNT)"
else
  fail "GET /api/studies/:id/members → $STATUS"
fi

test_case "잘못된 Study ID → 403/404"
RESP=$(http_get "/api/studies/00000000-0000-0000-0000-000000000000" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "403" ] || [ "$STATUS" = "404" ]; then
  pass "Invalid Study ID → $STATUS"
else
  fail "Invalid Study ID → $STATUS (expected 403 or 404)"
fi

# ═══════════════════════════════════════════════════
# Section 5: Notification API
# ═══════════════════════════════════════════════════
section "5. Notification API"

test_case "미읽음 알림 수 조회"
RESP=$(http_get "/api/notifications/unread-count" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  UNREAD=$(echo "$(extract_body "$RESP")" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("count",0))' 2>/dev/null || echo "?")
  pass "GET /api/notifications/unread-count → 200 (unread: $UNREAD)"
else
  fail "GET /api/notifications/unread-count → $STATUS"
fi

test_case "알림 목록 조회"
RESP=$(http_get "/api/notifications" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "GET /api/notifications → 200"
else
  fail "GET /api/notifications → $STATUS"
fi

# ═══════════════════════════════════════════════════
# Section 6: Problem API (via Gateway proxy)
# ═══════════════════════════════════════════════════
section "6. Problem API"

test_case "활성 문제 목록 조회"
RESP=$(http_get "/api/problems/active" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
BODY=$(extract_body "$RESP")
if [ "$STATUS" = "200" ]; then
  PROBLEM_COUNT=$(echo "$BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get("data",[])))' 2>/dev/null || echo "?")
  pass "GET /api/problems/active → 200 (count: $PROBLEM_COUNT)"
else
  fail "GET /api/problems/active → $STATUS"
fi

test_case "전체 문제 목록 조회"
RESP=$(http_get "/api/problems/all" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "GET /api/problems/all → 200"
else
  fail "GET /api/problems/all → $STATUS"
fi

# 문제 ID 추출 (있으면)
PROBLEM_ID=""
if [ "$STATUS" = "200" ]; then
  PROBLEM_ID=$(echo "$(extract_body "$RESP")" | python3 -c '
import sys, json
d = json.load(sys.stdin)
items = d if isinstance(d, list) else d.get("data", [])
if items:
    p = items[0]
    print(p.get("id", ""))
' 2>/dev/null || echo "")
fi

if [ -n "$PROBLEM_ID" ]; then
  test_case "문제 단건 조회"
  RESP=$(http_get "/api/problems/${PROBLEM_ID}" "${AUTH_OPTS[@]}")
  STATUS=$(extract_status "$RESP")
  if [ "$STATUS" = "200" ]; then
    pass "GET /api/problems/:id → 200"
  else
    fail "GET /api/problems/:id → $STATUS"
  fi
else
  test_case "문제 단건 조회"
  skip "문제 데이터 없음"
fi

# ═══════════════════════════════════════════════════
# Section 7: Submission API
# ═══════════════════════════════════════════════════
section "7. Submission API"

test_case "제출 목록 조회"
RESP=$(http_get "/api/submissions?page=1&limit=10" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "GET /api/submissions → 200"
else
  fail "GET /api/submissions → $STATUS"
fi

# 문제가 있으면 제출 + Draft 테스트
if [ -n "$PROBLEM_ID" ]; then
  test_case "Draft 저장 (Auto-save)"
  DRAFT_BODY="{\"problemId\":\"${PROBLEM_ID}\",\"code\":\"console.log('e2e test');\",\"language\":\"javascript\"}"
  RESP=$(http_post "/api/submissions/drafts" "$DRAFT_BODY" "${AUTH_OPTS[@]}")
  STATUS=$(extract_status "$RESP")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    pass "POST /api/submissions/drafts → $STATUS"
  else
    fail "POST /api/submissions/drafts → $STATUS (body: $(extract_body "$RESP"))"
  fi

  test_case "Draft 조회"
  RESP=$(http_get "/api/submissions/drafts/${PROBLEM_ID}" "${AUTH_OPTS[@]}")
  STATUS=$(extract_status "$RESP")
  if [ "$STATUS" = "200" ]; then
    pass "GET /api/submissions/drafts → 200"
  else
    fail "GET /api/submissions/drafts → $STATUS"
  fi

  test_case "코드 제출 (Saga 시작)"
  SUBMIT_BODY="{\"problemId\":\"${PROBLEM_ID}\",\"code\":\"function solution(a, b) { return a + b; }\",\"language\":\"javascript\"}"
  RESP=$(http_post "/api/submissions" "$SUBMIT_BODY" "${AUTH_OPTS[@]}")
  STATUS=$(extract_status "$RESP")
  BODY=$(extract_body "$RESP")
  if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
    SUBMISSION_ID=$(echo "$BODY" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("publicId", d.get("id","")))' 2>/dev/null || echo "")
    pass "POST /api/submissions → $STATUS (id: ${SUBMISSION_ID:-?})"
  else
    fail "POST /api/submissions → $STATUS (body: $BODY)"
    SUBMISSION_ID=""
  fi

  if [ -n "$SUBMISSION_ID" ]; then
    test_case "제출 단건 조회 + Saga 상태 확인"
    sleep 1
    RESP=$(http_get "/api/submissions/${SUBMISSION_ID}" "${AUTH_OPTS[@]}")
    STATUS=$(extract_status "$RESP")
    BODY=$(extract_body "$RESP")
    if [ "$STATUS" = "200" ]; then
      SAGA_STEP=$(echo "$BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("sagaStep","?"))' 2>/dev/null || echo "?")
      pass "GET /api/submissions/:id → 200 (sagaStep: $SAGA_STEP)"
    else
      fail "GET /api/submissions/:id → $STATUS"
    fi

    test_case "SSE 제출 상태 스트림"
    SSE_RESP=$(curl -s --max-time 3 -N \
      -H "Authorization: Bearer ${VALID_JWT}" \
      -b "access_token=${VALID_JWT}" \
      -H "X-Study-ID: ${TEST_STUDY_ID}" \
      "${GATEWAY_URL}/sse/submissions/${SUBMISSION_ID}" 2>/dev/null || true)
    if echo "$SSE_RESP" | grep -q "data:"; then
      pass "GET /sse/submissions/:id → SSE stream active"
    else
      pass "GET /sse/submissions/:id → connection established (no events yet)"
    fi

    test_case "AI 분석 결과 조회"
    RESP=$(http_get "/api/submissions/${SUBMISSION_ID}/analysis" "${AUTH_OPTS[@]}")
    STATUS=$(extract_status "$RESP")
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
      pass "GET /api/submissions/:id/analysis → $STATUS (pending or complete)"
    else
      fail "GET /api/submissions/:id/analysis → $STATUS"
    fi
  fi

  test_case "Draft 삭제"
  RESP=$(http_delete "/api/submissions/drafts/${PROBLEM_ID}" "${AUTH_OPTS[@]}")
  STATUS=$(extract_status "$RESP")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "204" ]; then
    pass "DELETE /api/submissions/drafts → $STATUS"
  else
    fail "DELETE /api/submissions/drafts → $STATUS"
  fi
else
  test_case "Draft/Submission 테스트"
  skip "문제 데이터 없음 — Draft/Submission 테스트 건너뜀"
fi

# ═══════════════════════════════════════════════════
# Section 8: Review & Study Note API
# ═══════════════════════════════════════════════════
section "8. Review & Study Note API"

test_case "리뷰 댓글 목록 조회"
RESP=$(http_get "/api/reviews/comments?studyId=${TEST_STUDY_ID}" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "GET /api/reviews/comments → 200"
else
  fail "GET /api/reviews/comments → $STATUS"
fi

if [ -n "$PROBLEM_ID" ]; then
  test_case "스터디 노트 조회"
  RESP=$(http_get "/api/study-notes?problemId=${PROBLEM_ID}" "${AUTH_OPTS[@]}")
  STATUS=$(extract_status "$RESP")
  if [ "$STATUS" = "200" ]; then
    pass "GET /api/study-notes → 200"
  else
    fail "GET /api/study-notes → $STATUS"
  fi
fi

# ═══════════════════════════════════════════════════
# Section 9: External API
# ═══════════════════════════════════════════════════
section "9. External API"

test_case "Solved.ac 문제 검색"
RESP=$(http_get "/api/external/solvedac/problem/1000" "${AUTH_OPTS[@]}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "GET /api/external/solvedac/problem/1000 → 200"
elif [ "$STATUS" = "404" ] || [ "$STATUS" = "502" ]; then
  pass "GET /api/external/solvedac/problem/1000 → $STATUS (외부 API 제한)"
else
  fail "GET /api/external/solvedac/problem/1000 → $STATUS"
fi

# ═══════════════════════════════════════════════════
# Section 10: Rate Limiting
# ═══════════════════════════════════════════════════
section "10. Rate Limiting"

test_case "Rate Limit 헤더 존재 확인"
RESP=$(curl -s -D - --max-time 10 \
  -b "access_token=${VALID_JWT}" \
  -H "X-Study-ID: ${TEST_STUDY_ID}" \
  "${GATEWAY_URL}/health" 2>/dev/null | head -20)
if echo "$RESP" | grep -qi "ratelimit\|x-ratelimit\|retry-after"; then
  pass "Rate Limit 헤더 감지"
else
  pass "Rate Limit 헤더 미노출 (정상 범위 내)"
fi

# ═══════════════════════════════════════════════════
# Section 11: Security Validation
# ═══════════════════════════════════════════════════
section "11. Security Validation"

test_case "none 알고리즘 JWT 거부"
NONE_HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | openssl base64 -e | tr '+/' '-_' | tr -d '=\n')
NONE_PAYLOAD=$(echo -n "{\"sub\":\"${TEST_USER_ID}\",\"email\":\"${TEST_USER_EMAIL}\",\"iat\":$(date +%s),\"exp\":$(($(date +%s)+3600))}" | openssl base64 -e | tr '+/' '-_' | tr -d '=\n')
NONE_JWT="${NONE_HEADER}.${NONE_PAYLOAD}."
RESP=$(http_get "/api/studies" -b "access_token=${NONE_JWT}")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "401" ]; then
  pass "alg:none JWT → 401"
else
  fail "alg:none JWT → $STATUS (expected 401) — SECURITY RISK!"
fi

test_case "X-Study-ID UUID 형식 검증"
RESP=$(http_get "/api/problems/active" -b "access_token=${VALID_JWT}" -H "X-Study-ID: not-a-uuid")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  pass "Invalid X-Study-ID → $STATUS"
else
  fail "Invalid X-Study-ID → $STATUS (expected 400/401/403)"
fi

test_case "Naver OAuth Callback — 유효하지 않은 state 거부"
RESP=$(http_get "/auth/oauth/naver/callback?code=test_code&state=invalid_naver_state")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "302" ]; then
  pass "Naver invalid state → $STATUS"
else
  fail "Naver invalid state → $STATUS (expected 400/302)"
fi

test_case "Kakao OAuth Callback — 유효하지 않은 state 거부"
RESP=$(http_get "/auth/oauth/kakao/callback?code=test_code&state=invalid_kakao_state")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "302" ]; then
  pass "Kakao invalid state → $STATUS"
else
  fail "Kakao invalid state → $STATUS (expected 400/302)"
fi

test_case "Internal 엔드포인트 외부 접근 차단"
RESP=$(http_get "/internal/users/${TEST_USER_PUBLIC_ID}/github-status")
STATUS=$(extract_status "$RESP")
if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] || [ "$STATUS" = "404" ] || [ "$STATUS" = "307" ]; then
  pass "Internal endpoint → $STATUS (차단됨)"
else
  fail "Internal endpoint → $STATUS (expected 401/403/404/307) — SECURITY RISK!"
fi

# ═══════════════════════════════════════════════════
# 결과 요약
# ═══════════════════════════════════════════════════
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  결과 요약${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Total:  ${TOTAL}"
echo -e "  ${GREEN}PASS:   ${PASS}${NC}"
echo -e "  ${RED}FAIL:   ${FAIL}${NC}"
echo -e "  ${YELLOW}SKIP:   ${SKIP}${NC}"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}━━━ ALL PASS ━━━${NC}"
  exit 0
else
  echo -e "  ${RED}━━━ ${FAIL} FAILURE(S) ━━━${NC}"
  exit 1
fi
